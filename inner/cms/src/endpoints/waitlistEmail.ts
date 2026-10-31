import type { Endpoint, PayloadRequest } from 'payload';
import { getPool, requireAdmin, type PgPool } from './util';
import { buildWaitlistEmail, type EmailAudience } from '../lib/waitlistEmailTemplate';
import { extractHeroAccent } from '../lib/heroAccent';
import { MANAGE_LINK_PLACEHOLDER, SAMPLE_TOKEN, manageUrl, withManageLink } from '../lib/manage/link';
import { tokensFor } from '../lib/manage/store';
import { membersAmong } from '../lib/members';
import { techTourFormId } from '../lib/retention';

/**
 * Admin-only bulk mail to the waitlist (`waitlist-signups` collection) – or,
 * with `audience: 'techtour'`, to every TechTour registration.
 *
 *   GET  /api/waitlist/email-recipients   unique-address counts, total + per locale
 *                                         (?audience=techtour: registrations instead;
 *                                          &members=1: only those marked as members)
 *   POST /api/waitlist/email-preview      body { message, locale?, audience?, headerImageUrl?,
 *                                                ctaLabel?, ctaUrl? } → { html }
 *   POST /api/waitlist/send-email         body { subject, message, locale?, audience?, members?,
 *                                                headerImageUrl?, ctaLabel?, ctaUrl?,
 *                                                test?, testRecipients? }
 *
 * A TechTour mail goes out once per registration, and `{{manageLink}}` in the
 * message or as the button link becomes that registration's own
 * /techtour/manage link (lib/manage/), whose token is made on the first send
 * and kept for every later one. Test mails and the preview get a sample link
 * that opens no registration. The language filter reads the language the
 * registration was sent in; `members` narrows it to the registrations marked
 * as Coding for Change members (lib/members.ts).
 *
 * Mails are rendered through the branded template in lib/waitlistEmailTemplate.ts
 * (logo header, optional full-width image, optional CTA button, bilingual
 * unsubscribe footer). The preview endpoint returns that exact rendering so the
 * compose form can show it live without duplicating the template client-side.
 *
 * Every recipient gets their own individual email, so addresses are never
 * exposed to other recipients — the reason this exists instead of a
 * hand-written BCC mail. Delivery reuses the transactional email config from
 * payload.config.ts (RESEND_API_KEY / EMAIL_FROM / EMAIL_FROM_NAME) but calls
 * Resend's batch API directly: 100 mails per request instead of one request
 * per mail, so a full-list send finishes in seconds rather than minutes.
 * Without an API key (local dev) it falls back to payload.sendEmail, which
 * logs each mail to the server console; in production a missing key is a 503,
 * never a silent no-op.
 *
 * Every message gets a bilingual footer explaining why the recipient is
 * getting it and how to unsubscribe (a short mail to CONTACT_TO_EMAIL —
 * replies also go there). `test: true` sends only to the logged-in admin —
 * or, when `testRecipients` is given, to that hand-picked list (≤10
 * addresses, e.g. personal inboxes to preview rendering in different mail
 * clients) — with the subject prefixed "[Test]". Test mode never reads the
 * waitlist.
 */

const FROM = () =>
  `${process.env.EMAIL_FROM_NAME || 'Coding for Change'} <${process.env.EMAIL_FROM || 'noreply@codingforchange.com'}>`;
const CONTACT = () => process.env.CONTACT_TO_EMAIL || 'info@codingforchange.com';
// Absolute origin referenced inside the mails (logo image, site link). Mails
// are read in real inboxes, so this must be the public site even when the CMS
// itself runs elsewhere (dev, docker-internal hostname, …).
const SITE_ORIGIN = () =>
  (process.env.PUBLIC_SITE_ORIGIN || 'https://codingforchange.com').replace(/\/+$/, '');

const BATCH_URL = 'https://api.resend.com/emails/batch';
const BATCH_SIZE = 100; // Resend's maximum per batch request
const BATCH_INTERVAL_MS = 600; // stay under Resend's default 2 requests/second

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Test sends may target a hand-picked address list (e.g. personal inboxes, to
// preview rendering across mail clients) instead of the admin's own address.
// Comma/semicolon/whitespace separated; the small cap keeps the test path
// from doubling as a second bulk sender.
const MAX_TEST_RECIPIENTS = 10;

const parseTestRecipients = (raw: unknown): { emails: string[] } | { error: string } => {
  const parts = Array.isArray(raw)
    ? raw.map((p) => String(p))
    : typeof raw === 'string'
      ? raw.split(/[\s,;]+/)
      : [];
  const emails = [...new Set(parts.map((p) => p.trim().toLowerCase()).filter(Boolean))];
  const invalid = emails.find((e) => !EMAIL_RE.test(e));
  if (invalid) return { error: `Invalid test recipient address: “${invalid}”` };
  if (emails.length > MAX_TEST_RECIPIENTS) {
    return { error: `At most ${MAX_TEST_RECIPIENTS} test recipients are allowed.` };
  }
  return { emails };
};

const isHttpUrl = (s: string): boolean => {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

type ComposeExtras = { headerImageUrl?: string; ctaLabel?: string; ctaUrl?: string };

// Optional template extras shared by send + preview: an image shown full-width
// under the logo header, and/or a CTA button below the message. URLs must be
// absolute http(s) — mail clients have nothing to resolve relative URLs
// against (the compose form resolves Media-collection paths before posting).
const parseComposeExtras = (
  body: {
    headerImageUrl?: unknown;
    ctaLabel?: unknown;
    ctaUrl?: unknown;
  },
  audience: EmailAudience = 'waitlist',
): ComposeExtras | { error: string } => {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const headerImageUrl = str(body.headerImageUrl);
  const ctaLabel = str(body.ctaLabel);
  const ctaUrl = str(body.ctaUrl);
  if (headerImageUrl && (headerImageUrl.length > 1000 || !isHttpUrl(headerImageUrl))) {
    return { error: 'Header image must be an absolute http(s) URL (max 1,000 characters).' };
  }
  if ((ctaLabel === '') !== (ctaUrl === '')) {
    return { error: 'Button label and button link belong together — fill in both or neither.' };
  }
  if (ctaLabel.length > 100) {
    return { error: 'Button label is too long (max 100 characters).' };
  }
  const personalLink = audience === 'techtour' && ctaUrl === MANAGE_LINK_PLACEHOLDER;
  if (ctaUrl && !personalLink && (ctaUrl.length > 1000 || !isHttpUrl(ctaUrl))) {
    return { error: 'Button link must be an absolute http(s) URL (max 1,000 characters).' };
  }
  return {
    headerImageUrl: headerImageUrl || undefined,
    ctaLabel: ctaLabel || undefined,
    ctaUrl: ctaUrl || undefined,
  };
};

// Signups store the site language; a German-only send gets <html lang="de">.
const langFor = (locale: string): 'de' | 'en' => (locale === 'de' ? 'de' : 'en');

const audienceOf = (raw: unknown): EmailAudience => (raw === 'techtour' ? 'techtour' : 'waitlist');

/** The personal link only exists for a registration, so only a TechTour mail may ask for it. */
const placeholderMisused = (audience: EmailAudience, ...texts: (string | undefined)[]): string | null =>
  audience !== 'techtour' && texts.some((t) => t?.includes(MANAGE_LINK_PLACEHOLDER))
    ? `${MANAGE_LINK_PLACEHOLDER} only works in a mail to the TechTour registrations.`
    : null;

type Registrant = { id: number; email: string; locale: string };

/**
 * Every TechTour registration with a usable address, oldest first, optionally
 * in one language and only members'. Read-only: the answers' `email` row, the
 * language the registration was sent in, and the member mark.
 */
async function techTourRegistrants(
  req: PayloadRequest,
  pool: PgPool,
  locale?: string,
  membersOnly = false,
): Promise<Registrant[]> {
  const formId = await techTourFormId(req.payload);
  if (formId == null) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (s.id) s.id, lower(trim(d.value)) AS email,
            COALESCE(s.language::text, 'unknown') AS locale
     FROM form_submissions s
     JOIN form_submissions_submission_data d ON d._parent_id = s.id AND d.field = 'email'
     WHERE s.form_id = $1
     ORDER BY s.id`,
    [formId],
  );
  const registrants = rows
    .map((r) => ({ id: Number(r.id), email: String(r.email), locale: String(r.locale) }))
    .filter((r) => EMAIL_RE.test(r.email) && (!locale || r.locale === locale));
  if (!membersOnly) return registrants;
  const members = await membersAmong(req.payload, registrants.map((r) => r.id));
  return registrants.filter((r) => members.has(r.id));
}

type BatchItem = {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
};

/**
 * POST the prepared per-recipient emails to Resend in chunks of 100.
 * 429/5xx/network errors are retried (up to 3 attempts per chunk, honouring
 * Retry-After); other 4xx rejections mark the whole chunk failed — Resend
 * validates batches atomically, so one bad address fails its chunk.
 */
async function sendViaResend(
  apiKey: string,
  items: BatchItem[],
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    if (i > 0) await sleep(BATCH_INTERVAL_MS);
    for (let attempt = 1; ; attempt += 1) {
      let res: Response;
      try {
        res = await fetch(BATCH_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
        });
      } catch (err) {
        if (attempt < 3) {
          await sleep(1000 * attempt);
          continue;
        }
        failed += chunk.length;
        errors.push(err instanceof Error ? err.message : 'network error');
        break;
      }
      if (res.ok) {
        sent += chunk.length;
        break;
      }
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        const after = Number(res.headers.get('retry-after'));
        await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : 1000 * attempt);
        continue;
      }
      failed += chunk.length;
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      errors.push(`Resend ${res.status}${detail ? `: ${detail}` : ''}`);
      break;
    }
  }
  return { sent, failed, errors };
}

const emailRecipients: Endpoint = {
  path: '/waitlist/email-recipients',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const pool = getPool(req);
    if (!pool) return new Response('Database unavailable', { status: 500 });
    if (audienceOf(req.searchParams.get('audience')) === 'techtour') {
      // One mail per registration (each has its own link), so registrations
      // are counted, not addresses.
      const all = await techTourRegistrants(req, pool, undefined, req.searchParams.get('members') === '1');
      const perLocale = new Map<string, number>();
      for (const r of all) perLocale.set(r.locale, (perLocale.get(r.locale) ?? 0) + 1);
      return Response.json({
        total: all.length,
        addresses: new Set(all.map((r) => r.email)).size,
        byLocale: [...perLocale]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([locale, count]) => ({ locale, count })),
      });
    }
    const [{ rows: byLocale }, { rows: totals }] = await Promise.all([
      pool.query(
        `SELECT COALESCE(NULLIF(locale, ''), 'unknown') AS locale,
                COUNT(DISTINCT lower(email))::int AS count
         FROM waitlist_signups
         GROUP BY 1
         ORDER BY 2 DESC, 1`,
      ),
      pool.query(`SELECT COUNT(DISTINCT lower(email))::int AS total FROM waitlist_signups`),
    ]);
    return Response.json({
      total: Number(totals[0]?.total) || 0,
      byLocale: byLocale.map((r) => ({
        locale: String(r.locale),
        count: Number(r.count) || 0,
      })),
    });
  },
};

const sendEmail: Endpoint = {
  path: '/waitlist/send-email',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    const denied = requireAdmin(req);
    if (denied) return denied;

    let body: {
      subject?: unknown;
      message?: unknown;
      locale?: unknown;
      audience?: unknown;
      members?: unknown;
      test?: unknown;
      testRecipients?: unknown;
      headerImageUrl?: unknown;
      ctaLabel?: unknown;
      ctaUrl?: unknown;
    };
    try {
      body = ((await req.json?.()) ?? {}) as typeof body;
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const locale = typeof body.locale === 'string' ? body.locale.trim() : '';
    const audience = audienceOf(body.audience);
    const membersOnly = audience === 'techtour' && body.members === true;
    const test = body.test === true;
    if (!subject || subject.length > 200) {
      return Response.json({ error: 'Subject is required (max 200 characters).' }, { status: 400 });
    }
    if (!message || message.length > 20000) {
      return Response.json({ error: 'Message is required (max 20,000 characters).' }, { status: 400 });
    }
    const extras = parseComposeExtras(body, audience);
    if ('error' in extras) {
      return Response.json({ error: extras.error }, { status: 400 });
    }
    const misused = placeholderMisused(audience, message, extras.ctaUrl);
    if (misused) return Response.json({ error: misused }, { status: 400 });

    // Recipients: the admin themself for a test run, otherwise every unique
    // waitlist address (optionally narrowed to one signup locale) – or every
    // TechTour registration, each with its own /techtour/manage link (`link`).
    // Addresses are lowercased on write by the collection hook; DISTINCT
    // lower() also catches anything older than that hook.
    let recipients: { to: string; link?: string }[];
    if (test) {
      const parsed = parseTestRecipients(body.testRecipients);
      if ('error' in parsed) {
        return Response.json({ error: parsed.error }, { status: 400 });
      }
      if (parsed.emails.length > 0) {
        recipients = parsed.emails.map((to) => ({ to }));
      } else {
        // No explicit list: default to the logged-in admin. req.user is
        // User | PayloadMcpApiKey (the MCP plugin's key auth); only real
        // admin users have an email to send the test to.
        const u = req.user;
        const adminEmail = u && 'email' in u && typeof u.email === 'string' ? u.email : null;
        if (!adminEmail) {
          return Response.json(
            { error: 'Test mode requires a logged-in admin user or explicit test recipients.' },
            { status: 400 },
          );
        }
        recipients = [{ to: adminEmail }];
      }
    } else if (audience === 'techtour') {
      const pool = getPool(req);
      if (!pool) return new Response('Database unavailable', { status: 500 });
      const registrants = await techTourRegistrants(req, pool, locale || undefined, membersOnly);
      const tokens = await tokensFor(req.payload, registrants.map((r) => r.id));
      // One per registration, not per address: someone registered twice
      // gets a mail for each, with that registration's link.
      recipients = registrants.flatMap((r) => {
        const token = tokens.get(r.id);
        return token ? [{ to: r.email, link: manageUrl(SITE_ORIGIN(), token) }] : [];
      });
    } else {
      const pool = getPool(req);
      if (!pool) return new Response('Database unavailable', { status: 500 });
      const where = locale ? `WHERE COALESCE(NULLIF(locale, ''), 'unknown') = $1` : '';
      const { rows } = await pool.query(
        `SELECT DISTINCT lower(trim(email)) AS email FROM waitlist_signups ${where} ORDER BY 1`,
        locale ? [locale] : [],
      );
      recipients = rows
        .map((r) => String(r.email))
        .filter((e) => EMAIL_RE.test(e))
        .map((to) => ({ to }));
    }
    if (recipients.length === 0) {
      return Response.json({ error: 'No recipients found.' }, { status: 400 });
    }

    const finalSubject = test ? `[Test] ${subject}` : subject;
    // Band tint behind the header image adapts to the artwork (memoized per
    // URL; null → neutral fallback). Never blocks a send: errors → null.
    const heroAccent = extras.headerImageUrl
      ? await extractHeroAccent(extras.headerImageUrl)
      : null;
    // A TechTour mail is rendered per recipient, with their own link in place
    // of the placeholder; a test gets the sample link. Everything else is
    // rendered once.
    const sampleLink = manageUrl(SITE_ORIGIN(), SAMPLE_TOKEN);
    const render = (link: string | null) =>
      buildWaitlistEmail({
        contactEmail: CONTACT(),
        siteOrigin: SITE_ORIGIN(),
        lang: langFor(locale),
        audience,
        heroAccent,
        ...extras,
        message: link ? withManageLink(message, link) : message,
        ctaUrl: link && extras.ctaUrl ? withManageLink(extras.ctaUrl, link) : extras.ctaUrl,
      });
    const shared = audience === 'techtour' ? null : render(null);
    const outgoing = recipients.map(({ to, link }) => ({ to, ...(shared ?? render(link ?? sampleLink)) }));

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const items: BatchItem[] = outgoing.map(({ to, html, text }) => ({
        from: FROM(),
        to: [to],
        reply_to: CONTACT(),
        subject: finalSubject,
        text,
        html,
        // Lets Gmail & co. show their native "Unsubscribe" affordance; the
        // mailto matches the manual unsubscribe flow described in the footer.
        headers: { 'List-Unsubscribe': `<mailto:${CONTACT()}?subject=Unsubscribe>` },
      }));
      const { sent, failed, errors } = await sendViaResend(apiKey, items);
      // Counts only — recipient addresses stay out of the server logs.
      req.payload.logger.info(
        `[waitlist-email] resend (${audience}${membersOnly ? ', members only' : ''}): ${sent} sent, ${failed} failed of ${recipients.length}${test ? ' (test)' : ''}`,
      );
      return Response.json({
        transport: 'resend',
        requested: recipients.length,
        sent,
        failed,
        errors: errors.slice(0, 3),
      });
    }

    // No API key: refuse in production rather than silently doing nothing…
    if (process.env.NODE_ENV === 'production') {
      return Response.json(
        { error: 'RESEND_API_KEY is not configured on the server.' },
        { status: 503 },
      );
    }
    // …but in local dev fall back to payload.sendEmail, which (with no email
    // adapter configured) logs each mail to the console — enough to preview
    // content and exercise the whole flow end to end.
    for (const { to, html, text } of outgoing) {
      await req.payload.sendEmail({ from: FROM(), to, subject: finalSubject, text, html });
    }
    req.payload.logger.info(
      `[waitlist-email] console: ${recipients.length} mail(s) logged (no RESEND_API_KEY)`,
    );
    return Response.json({
      transport: 'console',
      requested: recipients.length,
      sent: recipients.length,
      failed: 0,
      errors: [],
    });
  },
};

// Server-side render of exactly what /waitlist/send-email would deliver, so
// the compose form can show a live preview that cannot drift from the real
// mail. Same validation rules as the send path, minus subject/recipients.
const emailPreview: Endpoint = {
  path: '/waitlist/email-preview',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    let body: {
      message?: unknown;
      locale?: unknown;
      audience?: unknown;
      headerImageUrl?: unknown;
      ctaLabel?: unknown;
      ctaUrl?: unknown;
    };
    try {
      body = ((await req.json?.()) ?? {}) as typeof body;
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const locale = typeof body.locale === 'string' ? body.locale.trim() : '';
    const audience = audienceOf(body.audience);
    if (!message || message.length > 20000) {
      return Response.json(
        { error: 'Message is required (max 20,000 characters).' },
        { status: 400 },
      );
    }
    const extras = parseComposeExtras(body, audience);
    if ('error' in extras) {
      return Response.json({ error: extras.error }, { status: 400 });
    }
    const misused = placeholderMisused(audience, message, extras.ctaUrl);
    if (misused) return Response.json({ error: misused }, { status: 400 });
    const heroAccent = extras.headerImageUrl
      ? await extractHeroAccent(extras.headerImageUrl)
      : null;
    const sampleLink = manageUrl(SITE_ORIGIN(), SAMPLE_TOKEN);
    const { html, preheader } = buildWaitlistEmail({
      contactEmail: CONTACT(),
      siteOrigin: SITE_ORIGIN(),
      lang: langFor(locale),
      audience,
      heroAccent,
      ...extras,
      message: withManageLink(message, sampleLink),
      ctaUrl: extras.ctaUrl ? withManageLink(extras.ctaUrl, sampleLink) : undefined,
    });
    return Response.json({ html, preheader });
  },
};

export const waitlistEmailEndpoints: Endpoint[] = [emailRecipients, emailPreview, sendEmail];
