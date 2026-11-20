import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Role } from '../access/roles';

/**
 * "Sign in with Google" for the team's Workspace accounts: the OAuth
 * authorization code flow with `state` and PKCE, done by hand (no auth
 * framework), with the ID token checked against Google's published keys. The
 * endpoints are in endpoints/googleAuth.ts; everything here that decides
 * something is a plain function, so it is tested without a database
 * (googleAuth.test.ts).
 *
 * What the browser carries between the two legs is one short-lived signed
 * cookie (`cfc-oauth`, 10 minutes, only sent to /api/auth/google…): the
 * state, the PKCE verifier, the nonce and where to go afterwards. Nothing is
 * kept server-side, so a restart only means starting the sign-in again.
 */

export const OAUTH_COOKIE = 'cfc-oauth';
export const OAUTH_COOKIE_PATH = '/api/auth/google';
const OAUTH_MINUTES = 10;

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export const DEFAULT_ADMIN_EMAILS = ['info@codingforchange.com', 'jakob.landbrecht@codingforchange.com'];

// ---- configuration ----------------------------------------------------------

export type GoogleConfig = { clientId: string; clientSecret: string; allowedDomain: string };

type Env = Record<string, string | undefined>;

/** The OAuth client, or null when any part is missing: Google sign-in is then off. */
export function googleConfig(env: Env = process.env): GoogleConfig | null {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const allowedDomain = env.GOOGLE_ALLOWED_DOMAIN?.trim().toLowerCase();
  return clientId && clientSecret && allowedDomain ? { clientId, clientSecret, allowedDomain } : null;
}

/** The addresses that are always admins (`ADMIN_EMAILS`, comma separated), lower-cased. */
export function adminEmails(env: Env = process.env): string[] {
  const raw = env.ADMIN_EMAILS?.trim();
  const list = raw ? raw.split(',') : DEFAULT_ADMIN_EMAILS;
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

// ---- where to go afterwards -------------------------------------------------

const PROBE_ORIGIN = 'http://same-origin.invalid';

/**
 * `redirect` as a path on this site, or null when it is anything else: it has
 * to start with a single `/`, carry no backslash (browsers read `/\host` as
 * `//host`) and no control characters, and still be on this origin once
 * parsed. The result is the normalised path, query and hash.
 */
export function safeRedirect(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f\s]/.test(raw) || /%5c/i.test(raw) || /^\/%2f/i.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, PROBE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PROBE_ORIGIN) return null;
  const path = `${url.pathname}${url.search}${url.hash}`;
  return path.startsWith('//') ? null : path;
}

const isAdminPath = (path: string) => path === '/admin' || path.startsWith('/admin/') || path.startsWith('/admin?');

/**
 * Where a signed-in user lands: the requested path, unless it is the admin
 * panel and they are a member (they could not get in); without one, the
 * admin panel for editors and admins and the onboarding page for members.
 */
export function landingFor(role: Role, requested: string | null): string {
  if (role === 'member') return requested && !isAdminPath(requested) ? requested : '/onboarding';
  return requested ?? '/admin';
}

/**
 * The role a Google sign-in leaves the account with: an address on the admin
 * list is always admin; anyone else keeps the role the board gave them, and a
 * new account starts as member.
 */
export function roleAfterSignIn(email: string, current: Role | null, admins: string[]): Role {
  if (admins.includes(email.toLowerCase())) return 'admin';
  return current ?? 'member';
}

// ---- state, PKCE and the cookie ---------------------------------------------

const b64url = (buf: Buffer) => buf.toString('base64url');

export const randomToken = (bytes = 32) => b64url(randomBytes(bytes));

/** RFC 7636 S256: the challenge sent to Google for a verifier kept in the cookie. */
export const pkceChallenge = (verifier: string) => b64url(createHash('sha256').update(verifier).digest());

const key = () => createHash('sha256').update(`cfc-google-oauth:${process.env.PAYLOAD_SECRET ?? ''}`).digest();
const sign = (payload: string) => createHmac('sha256', key()).update(payload).digest('base64url');

export const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export type OAuthState = { state: string; verifier: string; nonce: string; redirect: string | null; expires: number };

export function newOAuthState(redirect: string | null, now = Date.now()): OAuthState {
  return { state: randomToken(), verifier: randomToken(), nonce: randomToken(), redirect, expires: now + OAUTH_MINUTES * 60_000 };
}

export function encodeOAuthState(s: OAuthState): string {
  const payload = Buffer.from(
    JSON.stringify({ s: s.state, v: s.verifier, n: s.nonce, r: s.redirect, x: s.expires }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function decodeOAuthState(value: string | undefined, now = Date.now()): OAuthState | null {
  if (!value) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra !== undefined || !same(signature, sign(payload))) return null;
  try {
    const { s, v, n, r, x } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof s !== 'string' || typeof v !== 'string' || typeof n !== 'string' || typeof x !== 'number') return null;
    if (x < now) return null;
    return { state: s, verifier: v, nonce: n, redirect: safeRedirect(r), expires: x };
  } catch {
    return null;
  }
}

const cookie = (value: string, maxAge: number) =>
  [
    `${OAUTH_COOKIE}=${value}`,
    `Path=${OAUTH_COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    // Lax, not Strict: the callback is a top-level navigation coming back from
    // accounts.google.com, and a Strict cookie would not be sent with it.
    'SameSite=Lax',
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
  ].join('; ');

export const oauthCookie = (s: OAuthState) => cookie(encodeOAuthState(s), OAUTH_MINUTES * 60);
export const clearedOAuthCookie = () => cookie('', 0);

// ---- talking to Google ------------------------------------------------------

export function authorizationUrl(cfg: GoogleConfig, redirectUri: string, s: OAuthState): string {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: s.state,
    nonce: s.nonce,
    code_challenge: pkceChallenge(s.verifier),
    code_challenge_method: 'S256',
    // Only offers accounts of the Workspace domain; the ID token's `hd` is
    // still checked, since anyone can edit this URL.
    hd: cfg.allowedDomain,
    prompt: 'select_account',
  }).toString();
  return url.href;
}

/** Trade the code for the ID token. Throws with Google's error on failure. */
export async function exchangeCode(cfg: GoogleConfig, redirectUri: string, code: string, verifier: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { id_token?: unknown; error?: unknown };
  if (!res.ok || typeof body.id_token !== 'string') {
    throw new Error(`token exchange failed (${res.status}${body.error ? `: ${String(body.error)}` : ''})`);
  }
  return body.id_token;
}

/**
 * Who the ID token says signed in, or why it is refused. jose has already
 * checked the signature, issuer, audience and expiry; this repeats the last
 * three (cheap, and keeps the rule readable in one place) and adds what is
 * ours: a verified address of the allowed Workspace domain, and our nonce.
 */
export function checkIdClaims(
  claims: JWTPayload & Record<string, unknown>,
  expected: { clientId: string; allowedDomain: string; nonce: string },
  now = Date.now(),
): { ok: true; email: string; name: string | null } | { ok: false; reason: string } {
  if (typeof claims.iss !== 'string' || !ISSUERS.includes(claims.iss)) return { ok: false, reason: 'issuer' };
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(expected.clientId)) return { ok: false, reason: 'audience' };
  if (aud.length > 1 && claims.azp !== expected.clientId) return { ok: false, reason: 'audience' };
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) return { ok: false, reason: 'expired' };
  if (typeof claims.nonce !== 'string' || !same(claims.nonce, expected.nonce)) return { ok: false, reason: 'nonce' };
  if (claims.email_verified !== true) return { ok: false, reason: 'email-unverified' };
  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
  const hd = typeof claims.hd === 'string' ? claims.hd.toLowerCase() : '';
  if (!email || hd !== expected.allowedDomain || !email.endsWith(`@${expected.allowedDomain}`)) {
    return { ok: false, reason: 'domain' };
  }
  const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : null;
  return { ok: true, email, name };
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/** Verify the ID token's signature against Google's keys (cached by jose), then our claims. */
export async function verifyIdToken(idToken: string, cfg: GoogleConfig, nonce: string) {
  jwks ??= createRemoteJWKSet(new URL(JWKS_URL));
  const { payload } = await jwtVerify(idToken, jwks, { issuer: ISSUERS, audience: cfg.clientId });
  return checkIdClaims(payload, { clientId: cfg.clientId, allowedDomain: cfg.allowedDomain, nonce });
}
