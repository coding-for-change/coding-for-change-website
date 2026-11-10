import type { Endpoint, PayloadRequest } from 'payload';
import { randomBytes } from 'node:crypto';
import { roleOf, type Role } from '../access/roles';
import {
  OAUTH_COOKIE,
  adminEmails,
  authorizationUrl,
  clearedOAuthCookie,
  decodeOAuthState,
  exchangeCode,
  googleConfig,
  landingFor,
  newOAuthState,
  oauthCookie,
  roleAfterSignIn,
  safeRedirect,
  same,
  verifyIdToken,
} from '../lib/googleAuth';
import { siteOrigin } from '../lib/mediaUpload';
import { issuePayloadSession } from '../lib/payloadSession';
import { readCookie } from '../lib/share/session';

/**
 * Google sign-in (lib/googleAuth.ts):
 *
 * - `GET /api/auth/google?redirect=/path` sends the browser to Google with a
 *   fresh state, PKCE challenge and nonce, kept in the `cfc-oauth` cookie.
 * - `GET /api/auth/google/callback` checks the state, trades the code for the
 *   ID token, checks it, finds the account by address (or makes one: member,
 *   or admin for an address in ADMIN_EMAILS) and signs it in with a native
 *   Payload session (lib/payloadSession.ts).
 *
 * Without GOOGLE_OAUTH_CLIENT_ID / _SECRET / GOOGLE_ALLOWED_DOMAIN both answer
 * 503 and the admin login page shows no Google button.
 */

const callbackUrl = () => `${siteOrigin()}/api/auth/google/callback`;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** A plain page saying what went wrong, in both languages, with the way back. */
function failure(status: number, de: string, en: string, extraHeaders: Record<string, string> = {}): Response {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Anmeldung / Sign-in</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1rem;color:#222}a{color:#0b57d0}</style></head>
<body><h1>Anmeldung nicht möglich</h1><p>${esc(de)}</p><p lang="en"><strong>Sign-in failed.</strong> ${esc(en)}</p>
<p><a href="/admin/login">Zur Anmeldung / Back to sign-in</a></p></body></html>`;
  const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  headers.append('Set-Cookie', clearedOAuthCookie());
  return new Response(html, { status, headers });
}

const notConfigured = () =>
  new Response('Google sign-in is not configured on this server.', {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });

const start: Endpoint = {
  path: '/auth/google',
  method: 'get',
  handler: async (req) => {
    const cfg = googleConfig();
    if (!cfg) return notConfigured();
    // Anything but a path on this site is dropped, and the role decides.
    const state = newOAuthState(safeRedirect(req.searchParams.get('redirect')));
    const headers = new Headers({ Location: authorizationUrl(cfg, callbackUrl(), state), 'Cache-Control': 'no-store' });
    headers.append('Set-Cookie', oauthCookie(state));
    return new Response(null, { status: 302, headers });
  },
};

type Account = { id: number | string; role: Role };

/** The account for this Google address, made or promoted as lib/googleAuth.ts says. */
async function accountFor(req: PayloadRequest, email: string): Promise<Account> {
  const { payload } = req;
  const admins = adminEmails();
  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  });
  const existing = found.docs[0];
  if (!existing) {
    const role = roleAfterSignIn(email, null, admins);
    const created = await payload.create({
      collection: 'users',
      // Nobody knows this password, and only admins may use one anyway.
      data: { email, role, password: randomBytes(32).toString('base64url') },
      overrideAccess: true,
      req,
    });
    payload.logger.info(`[google-auth] new ${role} account for ${email}`);
    return { id: created.id, role };
  }
  const current = roleOf({ ...existing, collection: 'users' }) ?? 'member';
  const role = roleAfterSignIn(email, current, admins);
  if (role !== current) {
    await payload.update({ collection: 'users', id: existing.id, data: { role }, overrideAccess: true, req });
    payload.logger.info(`[google-auth] ${email} promoted to ${role} (ADMIN_EMAILS)`);
  }
  return { id: existing.id, role };
}

const callback: Endpoint = {
  path: '/auth/google/callback',
  method: 'get',
  handler: async (req) => {
    const cfg = googleConfig();
    if (!cfg) return notConfigured();
    const params = req.searchParams;

    const saved = decodeOAuthState(readCookie(req.headers.get('cookie'), OAUTH_COOKIE));
    const state = params.get('state') ?? '';
    if (!saved || !state || !same(state, saved.state)) {
      return failure(
        400,
        'Die Anmeldung ist abgelaufen oder wurde in einem anderen Fenster begonnen. Bitte starte sie noch einmal.',
        'The sign-in expired or was started in another window. Please start it again.',
      );
    }
    if (params.get('error')) {
      return failure(400, 'Google hat die Anmeldung abgebrochen.', 'Google cancelled the sign-in.');
    }
    const code = params.get('code');
    if (!code) return failure(400, 'Google hat keinen Code geschickt.', 'Google sent no code.');

    let checked: Awaited<ReturnType<typeof verifyIdToken>>;
    try {
      const idToken = await exchangeCode(cfg, callbackUrl(), code, saved.verifier);
      checked = await verifyIdToken(idToken, cfg, saved.nonce);
    } catch (err) {
      req.payload.logger.error(err, '[google-auth] token exchange or verification failed');
      return failure(502, 'Google konnte die Anmeldung nicht bestätigen. Bitte versuche es noch einmal.', 'Google could not confirm the sign-in. Please try again.');
    }
    if (!checked.ok) {
      req.payload.logger.warn(`[google-auth] ID token refused: ${checked.reason}`);
      return checked.reason === 'domain'
        ? failure(
            403,
            `Bitte melde dich mit deiner @${cfg.allowedDomain}-Adresse an.`,
            `Please sign in with your @${cfg.allowedDomain} address.`,
          )
        : failure(403, 'Google hat die Adresse nicht bestätigt.', 'Google did not confirm the address.');
    }

    const account = await accountFor(req, checked.email);
    const session = await issuePayloadSession(req.payload, req, account.id);
    // A path, not a URL: the browser stays on the host the cookie was set for.
    const headers = new Headers({ Location: landingFor(account.role, saved.redirect), 'Cache-Control': 'no-store' });
    headers.append('Set-Cookie', session);
    headers.append('Set-Cookie', clearedOAuthCookie());
    return new Response(null, { status: 302, headers });
  },
};

export const googleAuthEndpoints: Endpoint[] = [start, callback];
