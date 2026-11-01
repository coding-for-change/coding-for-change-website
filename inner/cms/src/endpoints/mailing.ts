import type { Endpoint, PayloadRequest } from 'payload';
import { extractHeroAccent } from '../lib/heroAccent';
import { manageUrl, SAMPLE_TOKEN } from '../lib/manage/link';
import { tokensFor } from '../lib/manage/store';
import { cleanConfig, isSourceKey, SOURCES, type MailingConfig, type MailLang, type SourceKey } from '../lib/mailing/model';
import { renderMail, type MailLook, type MailSite } from '../lib/mailing/render';
import { countsOf, resolveMailing } from '../lib/mailing/resolve';
import { filtersOf, loadSource } from '../lib/mailing/sources';
import {
  allPersonMails,
  createMailing,
  deleteDraft,
  failUnsent,
  finishSend,
  getMailing,
  latestSendId,
  listMailings,
  lockForSending,
  previousMails,
  recipientsOf,
  recordResults,
  sendsOf,
  startSend,
  storedMail,
  storePending,
  unlock,
  updateMailing,
  type PendingMail,
} from '../lib/mailing/store';
import { sendResendBatch, type BatchItem } from '../lib/resendBatch';
import { requireAdmin as requireLogin } from './util';

/**
 * The mailing tool (/admin/mailing, lib/mailing/). Admins only.
 *
 *   GET    /api/mailing/mailings                   every mailing, with its send counts
 *   POST   /api/mailing/mailings                   { title, source, config } → { id }
 *   GET    /api/mailing/mailings/:id               { mailing, sends, recipients }
 *   PATCH  /api/mailing/mailings/:id               { title, config }
 *   DELETE /api/mailing/mailings/:id               only a mailing that never went out
 *   POST   /api/mailing/resolve                    { source, config, mailing? } → who gets what (Resolution)
 *   POST   /api/mailing/test                       { source, config, group, lang, to?, sampleName? }
 *   POST   /api/mailing/mailings/:id/send          { expected: { [group id]: count }, config, lastSend }
 *   GET    /api/mailing/recipients/:id             the stored mail as it was sent (text/html)
 *   GET    /api/mailing/people                     every mail sent, per address, for the review workspace
 *   GET    /api/mailing/sources                    each source's filters, with the options from the data
 *   POST   /api/mailing/accent                     { url } → the band colour for a header image (preview)
 *
 * A send works only from the saved mailing and checks it again on the server:
 * it takes the mailing's lock, refuses when the saved groups are not the ones
 * the admin checked (`config`: another tab saved in between, or a save got
 * lost), sorts the people into the groups once more and refuses when the
 * numbers differ from the ones the admin confirmed (someone was re-decided in
 * between), when the mailing was sent since the check (`lastSend`, the newest
 * send the admin saw – two admins confirming at once), or anything is in the way – an unwritten text, a
 * person in no group while "Only send when everyone is in a group" is on. Each
 * mail is stored as `pending` before it is handed to Resend and marked sent or
 * failed after, so a mailing set to reach everyone once never mails anyone
 * twice, even after a crash halfway.
 *
 * A TechTour mail that uses `{{manageLink}}` gets each registration's own
 * /techtour/manage link (lib/manage/), whose token is made on the first send
 * and kept for every later one; tests and the preview get a sample link that
 * opens nothing. Mails to the waitlist and the TechTour carry a
 * List-Unsubscribe header, as before; replies to an application do not.
 *
 * Every recipient gets their own mail (no addresses shared). Without
 * RESEND_API_KEY a local dev server logs the mails to the console instead;
 * production refuses with 503.
 */

const FROM = () =>
  `${process.env.EMAIL_FROM_NAME || 'Coding for Change'} <${process.env.EMAIL_FROM || 'noreply@codingforchange.com'}>`;

/** Where the mails point (logo, site link) and who they answer to – the public site, even from a dev CMS. */
export const mailSite = (): MailSite => ({
  siteOrigin: (process.env.PUBLIC_SITE_ORIGIN || 'https://codingforchange.com').replace(/\/+$/, ''),
  contactEmail: process.env.CONTACT_TO_EMAIL || 'info@codingforchange.com',
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEST_RECIPIENTS = 10;

/**
 * Admin users only: the MCP plugin's API keys log in too, but they are meant
 * for content, not for reading applicants' addresses or mailing them.
 */
const requireAdmin = (req: PayloadRequest): Response | null =>
  requireLogin(req) ?? (req.user?.collection === 'users' ? null : new Response('Forbidden', { status: 403 }));

/** The admin's address, or null for an API key (the MCP plugin's keys log in too). */
const adminEmail = (req: PayloadRequest): string | null => {
  const u = req.user;
  return u && u.collection === 'users' && typeof u.email === 'string' ? u.email : null;
};

const idParam = (req: PayloadRequest): number | null => {
  const id = Number(req.routeParams?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

async function body<T>(req: PayloadRequest): Promise<T | null> {
  try {
    return ((await req.json?.()) ?? {}) as T;
  } catch {
    return null;
  }
}

const bad = (error: string, status = 400) => Response.json({ error }, { status });

/** Hand mails to Resend – or, on a dev server without a key, to the console. */
async function deliver(
  req: PayloadRequest,
  source: SourceKey,
  mails: { to: string; subject: string; html: string; text: string }[],
  idempotencyKey?: string,
): Promise<{ id?: string; error?: string }[]> {
  const contact = mailSite().contactEmail;
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    // Lets Gmail & co. show their own "Unsubscribe" – the same short mail the footer asks for.
    const headers = SOURCES[source].unsubscribe ? { 'List-Unsubscribe': `<mailto:${contact}?subject=Unsubscribe>` } : undefined;
    const items: BatchItem[] = mails.map((m) => ({
      from: FROM(),
      to: [m.to],
      reply_to: contact,
      subject: m.subject,
      html: m.html,
      text: m.text,
      ...(headers ? { headers } : {}),
    }));
    return sendResendBatch(apiKey, items, idempotencyKey);
  }
  const out: { id?: string; error?: string }[] = [];
  for (const m of mails) {
    try {
      await req.payload.sendEmail({ from: FROM(), to: m.to, replyTo: contact, subject: m.subject, html: m.html, text: m.text });
      out.push({});
    } catch (err) {
      out.push({ error: err instanceof Error ? err.message : 'could not send' });
    }
  }
  return out;
}

/** The header image and the band colour behind it (never blocks a mail: no colour → neutral band). */
const lookOf = async (config: MailingConfig): Promise<MailLook> =>
  config.headerImageUrl
    ? { headerImageUrl: config.headerImageUrl, heroAccent: await extractHeroAccent(config.headerImageUrl).catch(() => null) }
    : {};

/** Whether any group's text, subject or button asks for the personal TechTour link. */
const usesManageLink = (config: MailingConfig): boolean =>
  config.groups.some((g) =>
    [g.ctaUrl, g.mail.en.subject, g.mail.en.message, g.mail.de.subject, g.mail.de.message].some((t) => /\{\{\s*manageLink\s*\}\}/.test(t)),
  );

const noTransport = () =>
  !process.env.RESEND_API_KEY && process.env.NODE_ENV === 'production'
    ? bad('RESEND_API_KEY is not configured on the server.', 503)
    : null;

// ---- mailings -------------------------------------------------------------------

const list: Endpoint = {
  path: '/mailing/mailings',
  method: 'get',
  handler: async (req) => requireAdmin(req) ?? Response.json({ mailings: await listMailings(req.payload) }),
};

const create: Endpoint = {
  path: '/mailing/mailings',
  method: 'post',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const b = await body<{ title?: unknown; source?: unknown; config?: unknown }>(req);
    if (!b) return bad('Invalid JSON body.');
    if (!isSourceKey(b.source)) return bad('Unknown source.');
    const title = typeof b.title === 'string' && b.title.trim() ? b.title.trim().slice(0, 200) : 'New mailing';
    const id = await createMailing(req.payload, {
      title,
      source: b.source,
      config: cleanConfig(b.config, b.source),
      by: adminEmail(req),
    });
    return Response.json({ id });
  },
};

const read: Endpoint = {
  path: '/mailing/mailings/:id',
  method: 'get',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const id = idParam(req);
    const mailing = id ? await getMailing(req.payload, id) : null;
    if (!id || !mailing) return bad('No such mailing.', 404);
    const [sends, recipients] = await Promise.all([sendsOf(req.payload, id), recipientsOf(req.payload, id)]);
    return Response.json({ mailing, sends, recipients });
  },
};

const update: Endpoint = {
  path: '/mailing/mailings/:id',
  method: 'patch',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const id = idParam(req);
    const mailing = id ? await getMailing(req.payload, id) : null;
    if (!id || !mailing) return bad('No such mailing.', 404);
    const b = await body<{ title?: unknown; config?: unknown }>(req);
    if (!b) return bad('Invalid JSON body.');
    const title = typeof b.title === 'string' && b.title.trim() ? b.title.trim().slice(0, 200) : mailing.title;
    await updateMailing(req.payload, id, { title, config: cleanConfig(b.config, mailing.source), by: adminEmail(req) });
    return Response.json({ ok: true });
  },
};

const remove: Endpoint = {
  path: '/mailing/mailings/:id',
  method: 'delete',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const id = idParam(req);
    if (!id) return bad('No such mailing.', 404);
    const result = await deleteDraft(req.payload, id);
    if (result === 'missing') return bad('No such mailing.', 404);
    if (result === 'sent') return bad('This mailing has gone out – it stays as history.', 409);
    return Response.json({ ok: true });
  },
};

// ---- checking, testing, sending ---------------------------------------------------

const resolve: Endpoint = {
  path: '/mailing/resolve',
  method: 'post',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const b = await body<{ source?: unknown; config?: unknown; mailing?: unknown }>(req);
    if (!b) return bad('Invalid JSON body.');
    if (!isSourceKey(b.source)) return bad('Unknown source.');
    const config = cleanConfig(b.config, b.source);
    const mailingId = Number(b.mailing);
    const [candidates, previous] = await Promise.all([
      loadSource(req.payload, b.source),
      Number.isInteger(mailingId) && mailingId > 0 ? previousMails(req.payload, mailingId, SOURCES[b.source].perEntry) : new Map(),
    ]);
    return Response.json(resolveMailing(b.source, config, candidates, previous));
  },
};

const test: Endpoint = {
  path: '/mailing/test',
  method: 'post',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const b = await body<{
      source?: unknown;
      config?: unknown;
      group?: unknown;
      lang?: unknown;
      to?: unknown;
      sampleName?: unknown;
    }>(req);
    if (!b) return bad('Invalid JSON body.');
    if (!isSourceKey(b.source)) return bad('Unknown source.');
    const transport = noTransport();
    if (transport) return transport;
    const config = cleanConfig(b.config, b.source);
    const group = config.groups.find((g) => g.id === b.group);
    if (!group) return bad('Pick a group to test.');
    const lang: MailLang = b.lang === 'de' ? 'de' : 'en';
    const to = [
      ...new Set(
        (typeof b.to === 'string' ? b.to.split(/[\s,;]+/) : [])
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (!to.length) {
      const own = adminEmail(req);
      if (!own) return bad('Enter an address for the test.');
      to.push(own.toLowerCase());
    }
    const wrong = to.find((e) => !EMAIL_RE.test(e));
    if (wrong) return bad(`Invalid address: “${wrong}”.`);
    if (to.length > MAX_TEST_RECIPIENTS) return bad(`At most ${MAX_TEST_RECIPIENTS} test addresses.`);
    // As the preview shows it: the sample person's first name, which may be empty.
    const firstName = typeof b.sampleName === 'string' ? b.sampleName.trim().slice(0, 100) : 'Alex';
    const site = mailSite();
    const mail = renderMail(b.source, group, { firstName, lang, manageLink: manageUrl(site.siteOrigin, SAMPLE_TOKEN) }, site, await lookOf(config));
    if (!mail) return bad('This group has no subject and text yet.');
    const results = await deliver(
      req,
      b.source,
      to.map((addr) => ({ to: addr, subject: `[Test] ${mail.subject}`, html: mail.html, text: mail.text })),
    );
    const errors = [...new Set(results.flatMap((r) => (r.error ? [r.error] : [])))];
    req.payload.logger.info(`[mailing] test (${b.source}): ${results.length - errors.length} of ${to.length} sent`);
    return Response.json({ sent: results.filter((r) => !r.error).length, failed: results.filter((r) => r.error).length, errors, to });
  },
};

const send: Endpoint = {
  path: '/mailing/mailings/:id/send',
  method: 'post',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const id = idParam(req);
    if (!id) return bad('No such mailing.', 404);
    const b = await body<{ expected?: unknown; config?: unknown; lastSend?: unknown }>(req);
    const expected = b?.expected && typeof b.expected === 'object' ? (b.expected as Record<string, unknown>) : null;
    if (!expected || !b?.config) return bad('Missing the confirmed numbers.');
    const transport = noTransport();
    if (transport) return transport;

    if (!(await lockForSending(req.payload, id))) {
      return bad('This mailing is being sent right now. Reload in a minute to see the result.', 409);
    }
    try {
      const mailing = await getMailing(req.payload, id);
      if (!mailing) return bad('No such mailing.', 404);
      const { source, config } = mailing;
      if (Number(b.lastSend ?? 0) !== (await latestSendId(req.payload, id))) {
        return bad('This mailing was sent since your check (another tab or another admin). Reload it to see who got what.', 409);
      }
      if (JSON.stringify(cleanConfig(b.config, source)) !== JSON.stringify(config)) {
        return bad('The saved mailing is not the one on your screen (edited in another tab, or not saved yet). Reload it, check, then send.', 409);
      }
      const [candidates, previous] = await Promise.all([
        loadSource(req.payload, source),
        previousMails(req.payload, id, SOURCES[source].perEntry),
      ]);
      const resolution = resolveMailing(source, config, candidates, previous);
      if (resolution.problems.length) {
        return Response.json({ error: resolution.problems[0], resolution }, { status: 400 });
      }
      const counts = countsOf(resolution);
      const moved =
        Object.keys(expected).length !== Object.keys(counts).length ||
        Object.entries(counts).some(([group, n]) => Number(expected[group]) !== n);
      if (moved) {
        return Response.json(
          { error: 'The recipients changed since your check (a decision or the mailing was edited). Check again, then send.', resolution },
          { status: 409 },
        );
      }

      const site = mailSite();
      const look = await lookOf(config);
      // Personal links only where a text asks for one; the tokens are made now and kept.
      const people = resolution.groups.flatMap((g) => g.people);
      const needLinks = SOURCES[source].placeholders.includes('manageLink') && usesManageLink(config);
      const tokens = needLinks
        ? await tokensFor(req.payload, people.flatMap((p) => (p.submission != null ? [p.submission] : [])))
        : new Map<number, string>();
      // Never send a mail with "{{manageLink}}" in it: no link for someone → nothing goes out.
      if (needLinks && people.some((p) => p.submission == null || !tokens.has(p.submission))) {
        return bad('Could not make the personal links for everyone – nothing was sent. Try again.', 500);
      }
      const pending: PendingMail[] = [];
      for (const g of resolution.groups) {
        const group = config.groups.find((x) => x.id === g.id)!;
        for (const p of g.people) {
          const token = p.submission != null ? tokens.get(p.submission) : undefined;
          const manageLink = token ? manageUrl(site.siteOrigin, token) : undefined;
          const mail = renderMail(source, group, { firstName: p.firstName, lang: p.lang, manageLink }, site, look);
          if (!mail) continue; // ruled out by problemsOf; never send an empty mail
          pending.push({
            submission: p.submission,
            waitlistSignup: p.waitlistSignup,
            email: p.email,
            name: p.name,
            groupId: group.id,
            groupLabel: group.label.trim() || 'Group',
            lang: mail.lang,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
          });
        }
      }

      const by = adminEmail(req);
      const sendId = await startSend(req.payload, { mailingId: id, by, requested: pending.length, config });
      let ids: number[];
      try {
        ids = await storePending(req.payload, id, sendId, pending);
      } catch (err) {
        // Nothing has gone to Resend yet: what got stored is marked failed, so a new send picks it up.
        await failUnsent(req.payload, sendId).catch(() => undefined);
        throw err;
      }
      const results = await deliver(
        req,
        source,
        pending.map((m) => ({ to: m.email, subject: m.subject, html: m.html, text: m.text })),
        `mailing-${id}-send-${sendId}`,
      );
      await recordResults(
        req.payload,
        results.map((r, i) => ({ id: ids[i], providerId: r.id ?? null, error: r.error ?? null })),
      );
      const failed = results.filter((r) => r.error).length;
      await finishSend(req.payload, sendId, results.length - failed, failed);
      // Counts only – addresses stay out of the server logs.
      req.payload.logger.info(
        `[mailing] #${id} send ${sendId} (${source}): ${results.length - failed} sent, ${failed} failed${process.env.RESEND_API_KEY ? '' : ' (console)'}`,
      );
      return Response.json({
        sendId,
        requested: pending.length,
        sent: results.length - failed,
        failed,
        errors: [...new Set(results.flatMap((r) => (r.error ? [r.error] : [])))].slice(0, 3),
        transport: process.env.RESEND_API_KEY ? 'resend' : 'console',
      });
    } finally {
      await unlock(req.payload, id);
    }
  },
};

// ---- history ----------------------------------------------------------------------

const viewMail: Endpoint = {
  path: '/mailing/recipients/:id',
  method: 'get',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const id = idParam(req);
    const mail = id ? await storedMail(req.payload, id) : null;
    if (!mail) return new Response('Not found', { status: 404 });
    if (req.searchParams.get('format') === 'text') {
      return new Response(`Subject: ${mail.subject}\n\n${mail.text}`, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    return new Response(mail.html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        // The mail's own markup only: images and inline styles, no scripts.
        'Content-Security-Policy': "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'",
      },
    });
  },
};

const people: Endpoint = {
  path: '/mailing/people',
  method: 'get',
  handler: async (req) => requireAdmin(req) ?? Response.json({ mails: await allPersonMails(req.payload) }),
};

const sources: Endpoint = {
  path: '/mailing/sources',
  method: 'get',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const keys = Object.keys(SOURCES) as SourceKey[];
    const filters = Object.fromEntries(await Promise.all(keys.map(async (k) => [k, await filtersOf(req.payload, k)] as const)));
    return Response.json({ filters });
  },
};

const accent: Endpoint = {
  path: '/mailing/accent',
  method: 'post',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const b = await body<{ url?: unknown }>(req);
    const url = typeof b?.url === 'string' ? b.url.trim() : '';
    if (!/^https?:\/\/\S+$/i.test(url) || url.length > 1000) return bad('An absolute image address is needed.');
    return Response.json({ accent: await extractHeroAccent(url).catch(() => null) });
  },
};

export const mailingEndpoints: Endpoint[] = [list, create, read, update, remove, resolve, test, send, viewMail, people, sources, accent];
