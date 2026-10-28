import type { Endpoint, PayloadRequest } from 'payload';
import { randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ShareAction } from '../collections/ShareAccessLog';
import { buildShareCodeEmail } from '../lib/share/codeEmail';
import { eveningOf } from '../lib/share/evening';
import { sharePage, type PageInput } from '../lib/share/page';
import {
  cvOf,
  decide,
  hostCvs,
  hostView,
  isRecipient,
  registrationInScope,
  type HostDecision,
  type ShareLinkDoc,
} from '../lib/share/registrations';
import {
  SHARE_COOKIE,
  checkCode,
  clearedCookie,
  decodeSession,
  issueCode,
  readCookie,
  sessionCookie,
} from '../lib/share/session';
import { zipSize, zipStream, type ZipEntry } from '../lib/share/zip';

/**
 * The host share links (collections/ShareLinks.ts), as the host's contact
 * uses them – public routes, guarded by the link's token plus a signed-in
 * contact:
 *
 *   GET  /api/share/:token                    the page (sign-in, or the registrations)
 *   POST /api/share/:token/code               { email } → a code by mail, if listed
 *   POST /api/share/:token/verify             { email, code } → sign-in cookie
 *   POST /api/share/:token/decision           { submissions: [id…], decision: 'admitted' | 'declined' | null }
 *   GET  /api/share/:token/cv/:submission     the registration's CV (PDF)
 *   GET  /api/share/:token/cvs?show=…         every CV in that view of the list, as one ZIP
 *   POST /api/share/:token/sign-out
 *
 * The site redirects /share/:token here (inner/next.config.ts), which is the
 * address the admin copies. Everything answers `no-store` and `noindex`.
 */

const CONTACT = () => process.env.CONTACT_TO_EMAIL || 'info@codingforchange.com';
const SITE_ORIGIN = () => (process.env.PUBLIC_SITE_ORIGIN || 'https://codingforchange.com').replace(/\/+$/, '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** What a token looks like (base64url, see collections/ShareLinks.ts) – nothing else reaches a query or a cookie path. */
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

const PRIVATE = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { ...PRIVATE, ...extra } });

type Context =
  | { state: 'missing' | 'expired' | 'blocked'; token: string; link: ShareLinkDoc | null }
  | { state: 'ok'; token: string; link: ShareLinkDoc; expiresAt: Date; email: string | null };

/** The link behind the URL's token, whether it may be used, and who is signed in to it. */
async function contextOf(req: PayloadRequest): Promise<Context> {
  const token = String(req.routeParams?.token ?? '');
  if (!TOKEN_RE.test(token)) return { state: 'missing', token, link: null };
  const found = await req.payload.find({
    collection: 'share-links',
    where: { token: { equals: token } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  });
  const link = found.docs[0] as unknown as ShareLinkDoc | undefined;
  if (!link) return { state: 'missing', token, link: null };
  if (link.blocked) return { state: 'blocked', token, link };
  const expiresAt = link.expiresAt ? new Date(link.expiresAt) : null;
  if (!expiresAt || expiresAt.getTime() <= Date.now()) return { state: 'expired', token, link };
  const session = decodeSession(readCookie(req.headers.get('cookie'), SHARE_COOKIE));
  const email = session && session.link === link.id && isRecipient(link, session.email) ? session.email : null;
  return { state: 'ok', token, link, expiresAt, email };
}

const log = (req: PayloadRequest, link: ShareLinkDoc, email: string, action: ShareAction, submission?: number) =>
  req.payload
    .create({
      collection: 'share-access-log',
      data: { link: link.id, email, action, ...(submission ? { submission } : {}) },
      overrideAccess: true,
    })
    .catch((err) => req.payload.logger.error(err, '[share] could not log an access'));

const body = async (req: PayloadRequest): Promise<Record<string, unknown>> => {
  try {
    return ((await req.json?.()) ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const notUsable = () => json({ error: 'This link does not work any more.' }, 404);
const signedOut = () => json({ error: 'Please sign in again.' }, 401);

const page: Endpoint = {
  path: '/share/:token',
  method: 'get',
  handler: async (req) => {
    const ctx = await contextOf(req);
    const nonce = randomBytes(16).toString('base64');
    const base = { nonce, contactEmail: CONTACT(), siteOrigin: SITE_ORIGIN() };
    let input: PageInput;
    let status = 200;
    if (ctx.state !== 'ok') {
      input = { ...base, state: 'invalid', reason: ctx.state };
      status = ctx.state === 'missing' ? 404 : 410;
    } else if (!ctx.email) {
      const formId = typeof ctx.link.form === 'object' && ctx.link.form ? ctx.link.form.id : ctx.link.form;
      const evening = formId != null ? await eveningOf(req.payload, formId, ctx.link.option, req) : null;
      input = { ...base, state: 'signin', token: ctx.token, title: ctx.link.title, evening, expiresAt: ctx.expiresAt };
    } else {
      const view = await hostView(req.payload, ctx.link, req);
      if (!view) {
        input = { ...base, state: 'invalid', reason: 'missing' };
        status = 404;
      } else {
        input = {
          ...base,
          state: 'list',
          token: ctx.token,
          title: ctx.link.title,
          evening: view.evening,
          expiresAt: ctx.expiresAt,
          email: ctx.email,
          rows: view.rows,
        };
      }
    }
    return new Response(sharePage(input), {
      status,
      headers: {
        ...PRIVATE,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': [
          "default-src 'none'",
          `script-src 'nonce-${nonce}'`,
          `style-src 'nonce-${nonce}'`,
          "img-src 'self'",
          // the CV next to the list, from this link's own CV route
          "frame-src 'self'",
          "connect-src 'self'",
          "base-uri 'none'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join('; '),
      },
    });
  },
};

const requestCode: Endpoint = {
  path: '/share/:token/code',
  method: 'post',
  handler: async (req) => {
    const ctx = await contextOf(req);
    if (ctx.state !== 'ok') return notUsable();
    const email = String((await body(req)).email ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);
    // Same answer whether or not the address is listed, so the page never
    // tells who is on the list.
    if (isRecipient(ctx.link, email)) {
      const code = issueCode(ctx.link.id, email);
      if (code) {
        const mail = buildShareCodeEmail({ code, title: ctx.link.title, siteOrigin: SITE_ORIGIN(), contactEmail: CONTACT() });
        try {
          await req.payload.sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
          await log(req, ctx.link, email, 'code');
        } catch (err) {
          req.payload.logger.error(err, '[share] could not send a sign-in code');
          return json({ error: 'We could not send the code just now – please try again in a minute.' }, 502);
        }
      }
    }
    return json({ ok: true });
  },
};

const verify: Endpoint = {
  path: '/share/:token/verify',
  method: 'post',
  handler: async (req) => {
    const ctx = await contextOf(req);
    if (ctx.state !== 'ok') return notUsable();
    const data = await body(req);
    const email = String(data.email ?? '').trim().toLowerCase();
    const code = String(data.code ?? '').replace(/\s+/g, '');
    if (!isRecipient(ctx.link, email) || !/^\d{6}$/.test(code) || !checkCode(ctx.link.id, email, code)) {
      return json({ error: 'That code is not right or has expired. Ask for a new one if needed.' }, 400);
    }
    await log(req, ctx.link, email, 'sign-in');
    return json(
      { ok: true },
      200,
      { 'Set-Cookie': sessionCookie(ctx.token, { link: ctx.link.id, email }, ctx.expiresAt) },
    );
  },
};

const DECISIONS = new Set<HostDecision | null>(['admitted', 'declined', null]);

const decision: Endpoint = {
  path: '/share/:token/decision',
  method: 'post',
  handler: async (req) => {
    const ctx = await contextOf(req);
    if (ctx.state !== 'ok') return notUsable();
    if (!ctx.email) return signedOut();
    const data = await body(req);
    const value = (data.decision ?? null) as HostDecision | null;
    const ids = (Array.isArray(data.submissions) ? data.submissions : []).map(Number).filter(Number.isInteger);
    if (!DECISIONS.has(value) || ids.length === 0 || ids.length > 500) {
      return json({ error: 'That did not work – please reload the page.' }, 400);
    }
    const decisions: Record<number, HostDecision | null> = {};
    for (const id of ids) {
      if (await decide(req.payload, ctx.link, id, value, ctx.email, req)) {
        decisions[id] = value;
        await log(req, ctx.link, ctx.email, value ?? 'undone', id);
      }
    }
    return json({ decisions });
  },
};

const cv: Endpoint = {
  path: '/share/:token/cv/:submission',
  method: 'get',
  handler: async (req) => {
    const ctx = await contextOf(req);
    if (ctx.state !== 'ok') return notUsable();
    if (!ctx.email) return signedOut();
    const id = Number(req.routeParams?.submission);
    const found = await registrationInScope(req.payload, ctx.link, id, req);
    const fileId = found ? cvOf(found.doc) : null;
    const file = fileId
      ? await req.payload
          .findByID({ collection: 'applicant-files', id: fileId, depth: 0, overrideAccess: true, req })
          .catch(() => null)
      : null;
    if (!found || !file?.filename) return json({ error: 'No CV for this registration.' }, 404);
    const dir = req.payload.collections['applicant-files'].config.upload.staticDir as string;
    let data: Buffer;
    try {
      data = await readFile(path.resolve(dir, path.basename(file.filename)));
    } catch {
      return json({ error: 'The CV could not be opened.' }, 404);
    }
    await log(req, ctx.link, ctx.email, 'cv', id);
    const answers = new Map((found.doc.submissionData ?? []).map((kv) => [kv.field, kv.value]));
    const who = [answers.get('firstName'), answers.get('lastName')].filter(Boolean).join(' ') || `registration ${id}`;
    const filename = `CV ${who}.pdf`.replace(/["\\\r\n]/g, '');
    return new Response(new Uint8Array(data), {
      headers: {
        ...PRIVATE,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  },
};

/** Who the page's filter shows – the same views as its All / Open / Admitted / Declined. */
const VIEWS = new Set(['all', 'open', 'admitted', 'declined']);
/** What a file name in the ZIP (or the ZIP's own) may not contain on any system. */
const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

const cvs: Endpoint = {
  path: '/share/:token/cvs',
  method: 'get',
  handler: async (req) => {
    const ctx = await contextOf(req);
    // A download is a plain click on a link: whatever stands in its way, go
    // back to the page, which says why or asks to sign in again.
    const back = () =>
      new Response(null, { status: 303, headers: { ...PRIVATE, Location: `/api/share/${encodeURIComponent(ctx.token)}` } });
    if (ctx.state !== 'ok' || !ctx.email) return back();
    const view = req.searchParams.get('show') ?? 'all';
    if (!VIEWS.has(view)) return back();
    const all = (await hostCvs(req.payload, ctx.link, req)) ?? [];
    const picked = all.filter(({ row }) => view === 'all' || (row.decision ?? 'open') === view);
    const { docs: files } = picked.length
      ? await req.payload.find({
          collection: 'applicant-files',
          where: { id: { in: picked.map((p) => p.file) } },
          depth: 0,
          pagination: false,
          overrideAccess: true,
          req,
        })
      : { docs: [] };
    const fileName = new Map(files.map((f) => [f.id, f.filename]));
    const dir = req.payload.collections['applicant-files'].config.upload.staticDir as string;
    const digits = String(all.at(-1)?.n ?? 0).length;
    const email = ctx.email;
    const entries = (
      await Promise.all(
        picked.map(async ({ n, row, file }): Promise<ZipEntry | null> => {
          const name = fileName.get(file);
          const at = name ? path.resolve(dir, path.basename(name)) : null;
          const info = at ? await stat(at).catch(() => null) : null;
          if (!at || !info?.isFile()) return null;
          return {
            // Numbered as on the page, so the files sort first come first.
            name: `${String(n).padStart(digits, '0')} ${fileSafe(row.name) || `Registration ${row.id}`}.pdf`,
            size: info.size,
            modified: info.mtime,
            read: async () => {
              await log(req, ctx.link, email, 'cv', row.id);
              return readFile(at);
            },
          };
        }),
      )
    ).filter((e): e is ZipEntry => e !== null);
    if (!entries.length) return back();
    const zipName = `CVs ${fileSafe(ctx.link.title)}${view === 'all' ? '' : ` – ${view}`}.zip`;
    return new Response(zipStream(entries), {
      headers: {
        ...PRIVATE,
        'Content-Type': 'application/zip',
        'Content-Length': String(zipSize(entries)),
        'Content-Disposition': `attachment; filename="${zipName.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      },
    });
  },
};

const signOut: Endpoint = {
  path: '/share/:token/sign-out',
  method: 'post',
  handler: async (req) => {
    const ctx = await contextOf(req);
    if (ctx.state === 'ok' && ctx.email) await log(req, ctx.link, ctx.email, 'sign-out');
    return TOKEN_RE.test(ctx.token)
      ? json({ ok: true }, 200, { 'Set-Cookie': clearedCookie(ctx.token) })
      : json({ ok: true });
  },
};

export const shareEndpoints: Endpoint[] = [page, requestCode, verify, decision, cv, cvs, signOut];
