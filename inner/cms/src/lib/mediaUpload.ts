import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import sharp from 'sharp';

/**
 * Upload links for the Media collection – how Claude (or anything else holding
 * an MCP key) gets an image into the CMS.
 *
 * MCP tool arguments are text the model writes, so a file cannot travel
 * through the connector itself. Instead the MCP tool `createMediaUploadUrl`
 * (lib/mcp.ts) hands out a link, and the file is POSTed there – by Claude from
 * its code sandbox (`curl -F file=@…`), or by a person on the small upload
 * page the same link shows in a browser (endpoints/mediaUpload.ts).
 *
 * The link's token is signed with a key derived from PAYLOAD_SECRET and holds
 * the MCP key, its user, the alt text and an expiry – nothing is stored. It
 * is good for 15 minutes and ONE successful upload: spent tokens are kept in
 * this process's memory until they expire (one CMS process serves the site; a
 * restart only means a spent link would work again for the rest of its 15
 * minutes). A failed upload (wrong file type, too big) does not spend it.
 *
 * Every upload re-checks that the MCP key still exists, still belongs to the
 * same user and may still create media, and runs as that user with access
 * control on – unticking a box or deleting the key kills its open links.
 *
 * Only raster images get in – JPEG, PNG, WebP, GIF – recognised by sharp from
 * the file's bytes, never from its name or the client's MIME type. SVG is
 * refused on purpose (it can carry script and would be served from our own
 * domain), as are videos and HEIC. Capped at 15 MB and 40 megapixels, which
 * keeps decompression bombs out of the WebP pipeline in collections/Media.ts.
 */

export const UPLOAD_MINUTES = 15;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
export const MAX_ALT_LENGTH = 300;

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const FORMATS: Record<string, { mimetype: (typeof ALLOWED_TYPES)[number]; ext: string }> = {
  jpeg: { mimetype: 'image/jpeg', ext: 'jpg' },
  png: { mimetype: 'image/png', ext: 'png' },
  webp: { mimetype: 'image/webp', ext: 'webp' },
  gif: { mimetype: 'image/gif', ext: 'gif' },
};

export const siteOrigin = (): string =>
  (process.env.PUBLIC_SITE_ORIGIN || 'https://codingforchange.com').replace(/\/+$/, '');

// ---- token ------------------------------------------------------------------

const key = () => createHash('sha256').update(`cfc-media-upload:${process.env.PAYLOAD_SECRET ?? ''}`).digest();
const sign = (payload: string) => createHmac('sha256', key()).update(payload).digest('base64url');

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** base64url payload, a dot, a base64url SHA-256 HMAC – nothing else is ever decoded. */
const TOKEN_RE = /^[A-Za-z0-9_-]{20,1600}\.[A-Za-z0-9_-]{43}$/;

type Id = number | string;
export type UploadGrant = {
  /** random id of this link – what "spent" is remembered by */
  jti: string;
  /** the payload-mcp-api-keys document that asked for the link */
  keyId: Id;
  /** that key's user; the upload runs as them */
  userId: Id;
  alt: string;
  expires: number;
};

const isId = (v: unknown): v is Id => (typeof v === 'number' && Number.isInteger(v)) || (typeof v === 'string' && v.length > 0 && v.length <= 64);

export function issueUploadToken(grant: Omit<UploadGrant, 'jti' | 'expires'>): { token: string; expires: number } {
  const expires = Date.now() + UPLOAD_MINUTES * 60_000;
  const jti = randomBytes(16).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ j: jti, k: grant.keyId, u: grant.userId, a: grant.alt, x: expires }),
  ).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, expires };
}

/** The grant behind a token – null when malformed, forged or expired. */
export function readUploadToken(token: string): UploadGrant | null {
  if (!TOKEN_RE.test(token)) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !same(signature, sign(payload))) return null;
  try {
    const raw = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    const { j, k, u, a, x } = raw;
    if (typeof j !== 'string' || !isId(k) || !isId(u) || typeof a !== 'string' || typeof x !== 'number') return null;
    if (x <= Date.now()) return null;
    return { jti: j, keyId: k, userId: u, alt: a, expires: x };
  } catch {
    return null;
  }
}

// ---- one successful upload per link -----------------------------------------

const spent = new Map<string, number>();
const inFlight = new Set<string>();

const sweep = () => {
  const now = Date.now();
  for (const [jti, expires] of spent) if (expires <= now) spent.delete(jti);
};

export const isSpent = (jti: string): boolean => {
  sweep();
  return spent.has(jti);
};

/** Reserve the link for one upload; false while it is spent or another upload on it is running. */
export function claim(grant: UploadGrant): boolean {
  sweep();
  if (spent.has(grant.jti) || inFlight.has(grant.jti)) return false;
  inFlight.add(grant.jti);
  return true;
}

/** End the reservation – `succeeded` spends the link for good. */
export function release(grant: UploadGrant, succeeded: boolean): void {
  inFlight.delete(grant.jti);
  if (succeeded) spent.set(grant.jti, grant.expires);
}

// ---- the file ---------------------------------------------------------------

export type CheckedImage = { mimetype: string; ext: string; width: number; height: number };

/** What the bytes really are – or the reason they are refused. Decodes the header only. */
export async function checkImage(data: Buffer): Promise<CheckedImage | { error: string }> {
  // SVG first: sharp may not even read one without a size, and the answer
  // should say why it is refused rather than "not readable".
  if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<(svg|!doctype svg)/i.test(data.subarray(0, 4096).toString('utf8'))) {
    return {
      error:
        'SVG is not accepted here (it can carry scripts). Convert it to PNG first, about 1600 px wide – e.g. `rsvg-convert -w 1600 logo.svg -o logo.png` – and upload the PNG.',
    };
  }
  let meta: sharp.Metadata;
  try {
    meta = await sharp(data, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).metadata();
  } catch (err) {
    if (err instanceof Error && /pixel limit/i.test(err.message)) {
      return { error: 'The image is too large (over 40 megapixels).' };
    }
    return { error: 'Not a readable image. Upload a JPEG, PNG, WebP or GIF.' };
  }
  const format = meta.format ? FORMATS[meta.format] : undefined;
  if (!format) {
    const what = meta.format === 'svg' ? 'SVG' : meta.format === 'heif' ? 'HEIC/AVIF' : (meta.format ?? 'this format');
    return { error: `${what} is not accepted here. Upload a JPEG, PNG, WebP or GIF.` };
  }
  const width = meta.width ?? 0;
  const height = meta.pageHeight ?? meta.height ?? 0;
  if (!width || !height) return { error: 'The image has no size.' };
  // Every frame of an animated GIF/WebP gets decoded in the WebP pipeline, so
  // the cap counts all of them, not just the first.
  if (width * height * Math.max(1, meta.pages ?? 1) > MAX_PIXELS) {
    return { error: 'The image is too large (over 40 megapixels, counting every frame).' };
  }
  return { ...format, width, height };
}

/** A plain file name with the extension the bytes call for (Payload re-encodes to WebP anyway). */
export function safeFilename(name: string | undefined, ext: string): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? '';
  const stem = base
    .replace(/\.[^.]*$/, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  return `${stem || 'upload'}.${ext}`;
}
