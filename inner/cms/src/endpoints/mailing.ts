import type { Endpoint, PayloadRequest } from 'payload';
import { cleanConfig, isSourceKey, type MailLang } from '../lib/mailing/model';
import { renderMail, type MailSite } from '../lib/mailing/render';
import { countsOf, resolveMailing } from '../lib/mailing/resolve';
import { loadSource } from '../lib/mailing/sources';
import {
  allPersonMails,
  createMailing,
  deleteDraft,
  finishSend,
  getMailing,
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
import { requireAdmin } from './util';

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
 *   POST   /api/mailing/mailings/:id/send          { expected: { [group id]: count } }
 *   GET    /api/mailing/recipients/:id             the stored mail as it was sent (text/html)
 *   GET    /api/mailing/people                     every mail sent, per address, for the review workspace
 *
 * A send works only from the saved mailing and checks it again on the server:
 * it takes the mailing's lock, sorts the people into the groups once more and
 * refuses when the numbers differ from the ones the admin confirmed (someone
 * was re-decided in between) or anything is in the way – an unwritten text, a
 * person in no group while "Only send when everyone is in a group" is on. Each
 * mail is stored as `pending` before it is handed to Resend and marked sent or
 * failed after, so a mailing set to reach everyone once never mails anyone
 * twice, even after a crash halfway.
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
  mails: { to: string; subject: string; html: string; text: string }[],
  idempotencyKey?: string,
): Promise<{ id?: string; error?: string }[]> {
  const contact = mailSite().contactEmail;
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const items: BatchItem[] = mails.map((m) => ({
      from: FROM(),
      to: [m.to],
      reply_to: contact,
      subject: m.subject,
      html: m.html,
      text: m.text,
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
      Number.isInteger(mailingId) && mailingId > 0 ? previousMails(req.payload, mailingId) : new Map(),
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
    const firstName = typeof b.sampleName === 'string' && b.sampleName.trim() ? b.sampleName.trim().slice(0, 100) : 'Alex';
    const mail = renderMail(b.source, group, { firstName, lang }, mailSite());
    if (!mail) return bad('This group has no subject and text yet.');
    const results = await deliver(
      req,
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
    const b = await body<{ expected?: unknown }>(req);
    const expected = b?.expected && typeof b.expected === 'object' ? (b.expected as Record<string, unknown>) : null;
    if (!expected) return bad('Missing the confirmed numbers.');
    const transport = noTransport();
    if (transport) return transport;

    if (!(await lockForSending(req.payload, id))) {
      return bad('This mailing is being sent right now. Reload in a minute to see the result.', 409);
    }
    try {
      const mailing = await getMailing(req.payload, id);
      if (!mailing) return bad('No such mailing.', 404);
      const { source, config } = mailing;
      const [candidates, previous] = await Promise.all([loadSource(req.payload, source), previousMails(req.payload, id)]);
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
      const pending: PendingMail[] = [];
      for (const g of resolution.groups) {
        const group = config.groups.find((x) => x.id === g.id)!;
        for (const p of g.people) {
          const mail = renderMail(source, group, { firstName: p.firstName, lang: p.lang }, site);
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
      const ids = await storePending(req.payload, id, sendId, pending);
      const results = await deliver(
        req,
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

export const mailingEndpoints: Endpoint[] = [list, create, read, update, remove, resolve, test, send, viewMail, people];
