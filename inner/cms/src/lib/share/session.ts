import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Signing in to a host share link: a six-digit code by email, then a signed
 * cookie.
 *
 * The cookie (`cfc-share`) holds the link id, the contact's address and an
 * expiry, signed with a key derived from PAYLOAD_SECRET – nothing is stored
 * server-side, and every request re-checks the link (not blocked, not
 * expired, address still listed). It is scoped to the link's own path, so it
 * is sent nowhere else on the site, and it lasts 12 hours at most.
 *
 * Codes live in this process's memory for 10 minutes: one CMS process serves
 * the site, and a restart only means asking for a new code.
 */

export const SHARE_COOKIE = 'cfc-share';
const SESSION_HOURS = 12;
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
/** Codes per address and link in a 10-minute window, and per link per hour. */
const SENDS_PER_ADDRESS = 3;
const SENDS_PER_LINK = 30;

const key = () => createHash('sha256').update(`cfc-share-session:${process.env.PAYLOAD_SECRET ?? ''}`).digest();
const sign = (payload: string) => createHmac('sha256', key()).update(payload).digest('base64url');

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export type ShareSession = { link: number; email: string; expires: number };

export function encodeSession(s: ShareSession): string {
  const payload = Buffer.from(JSON.stringify({ l: s.link, e: s.email, x: s.expires })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(value: string | undefined): ShareSession | null {
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature || !same(signature, sign(payload))) return null;
  try {
    const { l, e, x } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof l !== 'number' || typeof e !== 'string' || typeof x !== 'number' || x < Date.now()) return null;
    return { link: l, email: e, expires: x };
  } catch {
    return null;
  }
}

export const readCookie = (header: string | null, name: string): string | undefined =>
  header
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);

/** The Set-Cookie value for a fresh session; it never outlives the link. */
export function sessionCookie(token: string, s: Omit<ShareSession, 'expires'>, linkExpires: Date): string {
  const expires = Math.min(Date.now() + SESSION_HOURS * 3_600_000, linkExpires.getTime());
  const maxAge = Math.max(0, Math.floor((expires - Date.now()) / 1000));
  return cookie(token, encodeSession({ ...s, expires }), maxAge);
}

export const clearedCookie = (token: string) => cookie(token, '', 0);

const cookie = (token: string, value: string, maxAge: number) =>
  [
    `${SHARE_COOKIE}=${value}`,
    `Path=/api/share/${token}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Strict',
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
  ].join('; ');

// ---- codes ------------------------------------------------------------------

type CodeEntry = { hash: string; expires: number; attempts: number };
const codes = new Map<string, CodeEntry>();
const sends = new Map<string, number[]>();

const codeHash = (k: string, code: string) => createHash('sha256').update(`${k}:${code}`).digest('hex');

const recent = (k: string, windowMs: number) => (sends.get(k) ?? []).filter((t) => t > Date.now() - windowMs);

/**
 * A new code for this address on this link, or null when it has had too many
 * lately. The caller sends it; the response to the visitor is the same either
 * way, so the page never tells which addresses are on the list.
 */
export function issueCode(link: number, email: string): string | null {
  const k = `${link}:${email}`;
  const byAddress = recent(k, CODE_MINUTES * 60_000);
  const byLink = recent(`${link}`, 3_600_000);
  if (byAddress.length >= SENDS_PER_ADDRESS || byLink.length >= SENDS_PER_LINK) return null;
  sends.set(k, [...byAddress, Date.now()]);
  sends.set(`${link}`, [...byLink, Date.now()]);
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  codes.set(k, { hash: codeHash(k, code), expires: Date.now() + CODE_MINUTES * 60_000, attempts: 0 });
  return code;
}

/** True once for the right code; five wrong tries use the code up. */
export function checkCode(link: number, email: string, code: string): boolean {
  const k = `${link}:${email}`;
  const entry = codes.get(k);
  if (!entry || entry.expires < Date.now() || entry.attempts >= MAX_ATTEMPTS) {
    codes.delete(k);
    return false;
  }
  if (same(entry.hash, codeHash(k, code.trim()))) {
    codes.delete(k);
    return true;
  }
  entry.attempts += 1;
  return false;
}
