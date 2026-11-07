import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Download links for applicant files (CVs) – how Claude reads a CV over the
 * MCP connector. A tool result cannot carry a PDF, so the MCP tool
 * `createApplicantFileDownloadUrl` (lib/mcpAdmin.ts) hands out a link that
 * Claude fetches from its code sandbox (endpoints/applicantFileLink.ts).
 *
 * The token is signed with a key derived from PAYLOAD_SECRET and holds the
 * file, the MCP key, its user and an expiry – nothing is stored. It works for
 * 10 minutes. Every download checks again that the key still exists, still
 * belongs to the same user and may still read applicant files, so unticking
 * the box or deleting the key kills open links.
 */

export const DOWNLOAD_MINUTES = 10;

type Id = number | string;
export type DownloadGrant = { fileId: Id; keyId: Id; userId: Id; expires: number };

const key = () => createHash('sha256').update(`cfc-applicant-file:${process.env.PAYLOAD_SECRET ?? ''}`).digest();
const sign = (payload: string) => createHmac('sha256', key()).update(payload).digest('base64url');

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const TOKEN_RE = /^[A-Za-z0-9_-]{20,400}\.[A-Za-z0-9_-]{43}$/;
const isId = (v: unknown): v is Id =>
  (typeof v === 'number' && Number.isInteger(v)) || (typeof v === 'string' && v.length > 0 && v.length <= 64);

export function issueDownloadToken(grant: Omit<DownloadGrant, 'expires'>): { token: string; expires: number } {
  const expires = Date.now() + DOWNLOAD_MINUTES * 60_000;
  const payload = Buffer.from(JSON.stringify({ f: grant.fileId, k: grant.keyId, u: grant.userId, x: expires })).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, expires };
}

/** The grant behind a token – null when malformed, forged or expired. */
export function readDownloadToken(token: string): DownloadGrant | null {
  if (!TOKEN_RE.test(token)) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !same(signature, sign(payload))) return null;
  try {
    const { f, k, u, x } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (!isId(f) || !isId(k) || !isId(u) || typeof x !== 'number' || x <= Date.now()) return null;
    return { fileId: f, keyId: k, userId: u, expires: x };
  } catch {
    return null;
  }
}
