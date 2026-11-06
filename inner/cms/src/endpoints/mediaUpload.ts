import type { Endpoint, PayloadRequest } from 'payload';
import { addDataAndFileToRequest } from 'payload';
import { randomBytes } from 'node:crypto';
import { escapeHtml as esc } from '../lib/waitlistEmailTemplate';
import {
  ALLOWED_TYPES,
  MAX_UPLOAD_BYTES,
  checkImage,
  claim,
  isSpent,
  readUploadToken,
  release,
  safeFilename,
  siteOrigin,
  type UploadGrant,
} from '../lib/mediaUpload';

/**
 * The upload links the MCP tool `createMediaUploadUrl` hands out
 * (lib/mcp.ts) – public routes, guarded by nothing but the signed token
 * (lib/mediaUpload.ts):
 *
 *   GET  /api/media-upload/:token   a small upload form, for a person in a browser
 *   POST /api/media-upload/:token   multipart/form-data with one field "file"
 *                                   → JSON { id, filename, url, … } (or an HTML page for the form)
 *
 * Who uploads is decided by the token alone: a logged-in admin cookie on the
 * request is ignored, and the media document is created as the MCP key's user
 * with access control on. No CORS headers – browsers on other sites cannot
 * read the answers. Everything answers `no-store`, `noindex`, `no-referrer`.
 */

const PRIVATE = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

/** Multipart framing on top of the file itself. */
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

const wantsHtml = (req: PayloadRequest) => (req.headers.get('accept') ?? '').includes('text/html');

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: PRIVATE });

function page(nonce: string, title: string, body: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>${esc(title)} – Coding for Change</title>
<style nonce="${nonce}">
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 32px 16px; background: #f6f6f4; color: #1b1b1b; }
  main { max-width: 480px; margin: 0 auto; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  .muted { color: #666; font-size: 14px; }
  input[type=file] { display: block; margin: 16px 0; max-width: 100%; }
  button { font: inherit; padding: 8px 16px; border: 0; border-radius: 6px; background: #1b1b1b; color: #fff; cursor: pointer; }
  a { color: inherit; }
</style></head><body><main>${body}</main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      ...PRIVATE,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': [
        "default-src 'none'",
        `style-src 'nonce-${nonce}'`,
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
    },
  });
}

const nonceOf = () => randomBytes(16).toString('base64');

/** The same answer as JSON for curl, or as a page for the browser form. */
function fail(req: PayloadRequest, status: number, error: string, retryable = false): Response {
  if (!wantsHtml(req)) return json({ error }, status);
  const back = retryable ? `<p><a href="">Try another file</a></p>` : '';
  return page(nonceOf(), 'Upload failed', `<h1>Upload failed</h1><p>${esc(error)}</p>${back}`, status);
}

const GONE = 'This upload link is invalid, has expired or was already used. Ask Claude for a new one.';

const tokenOf = (req: PayloadRequest) => String(req.routeParams?.token ?? '');

/** Still allowed? The key must exist, belong to the same user, may create media and have this tool on. */
async function uploaderOf(req: PayloadRequest, grant: UploadGrant) {
  const { payload } = req;
  const apiKey = (await payload
    .findByID({ collection: 'payload-mcp-api-keys', id: grant.keyId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Record<string, unknown> | null;
  if (!apiKey) return null;
  const owner = apiKey.user && typeof apiKey.user === 'object' ? (apiKey.user as { id?: unknown }).id : apiKey.user;
  if (String(owner) !== String(grant.userId)) return null;
  if (apiKey.enableAPIKey !== true) return null;
  if ((apiKey.media as { create?: boolean } | undefined)?.create !== true) return null;
  if ((apiKey['payload-mcp-tool'] as Record<string, boolean> | undefined)?.createMediaUploadUrl === false) return null;
  const user = await payload
    .findByID({ collection: 'users', id: grant.userId, depth: 0, overrideAccess: true })
    .catch(() => null);
  return user ? { ...user, collection: 'users' as const } : null;
}

export const mediaUploadEndpoints: Endpoint[] = [
  {
    path: '/media-upload/:token',
    method: 'get',
    handler: async (req) => {
      const grant = readUploadToken(tokenOf(req));
      const nonce = nonceOf();
      if (!grant || isSpent(grant.jti)) {
        return page(nonce, 'Link expired', `<h1>Link expired</h1><p>${esc(GONE)}</p>`, 410);
      }
      const until = new Date(grant.expires).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Berlin',
      });
      return page(
        nonce,
        'Upload an image',
        `<h1>Upload an image</h1>
<p>For the media library of codingforchange.com, as: <strong>${esc(grant.alt)}</strong></p>
<form method="post" enctype="multipart/form-data">
  <input type="file" name="file" accept="${ALLOWED_TYPES.join(',')}" required>
  <button type="submit">Upload</button>
</form>
<p class="muted">JPEG, PNG, WebP or GIF, max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB. This link works once and until ${esc(until)}.</p>`,
      );
    },
  },
  {
    path: '/media-upload/:token',
    method: 'post',
    handler: async (req) => {
      const { payload } = req;
      const grant = readUploadToken(tokenOf(req));
      if (!grant || isSpent(grant.jti)) return fail(req, 410, GONE);

      // Refuse oversized or unframed bodies before reading a byte of them.
      const length = Number(req.headers.get('content-length') ?? NaN);
      if (!Number.isFinite(length) || length <= 0) return fail(req, 411, 'Send the file with a Content-Length.', true);
      if (length > MAX_BODY_BYTES) return fail(req, 413, `The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`, true);
      if (!(req.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
        return fail(req, 415, 'Send the file as multipart/form-data in a field named "file".', true);
      }

      if (!claim(grant)) return fail(req, 409, 'An upload on this link is already running or done.');
      let succeeded = false;
      try {
        const user = await uploaderOf(req, grant);
        if (!user) return fail(req, 403, 'The MCP key behind this link may no longer upload media.');

        await addDataAndFileToRequest(req);
        const file = req.file;
        if (!file?.data?.length) return fail(req, 400, 'No file in the field "file".', true);
        if (file.data.length > MAX_UPLOAD_BYTES) {
          return fail(req, 413, `The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`, true);
        }
        const image = await checkImage(file.data);
        if ('error' in image) return fail(req, 415, image.error, true);

        const doc = await payload.create({
          collection: 'media',
          data: { alt: grant.alt },
          file: {
            data: file.data,
            mimetype: image.mimetype,
            name: safeFilename(file.name, image.ext),
            size: file.data.length,
          },
          user,
          overrideAccess: false,
          depth: 0,
        });
        succeeded = true;
        payload.logger.info(
          `[media-upload] media ${doc.id} (${doc.filename}) created via MCP key ${grant.keyId} (user ${grant.userId})`,
        );

        const url = doc.url ? new URL(doc.url, siteOrigin()).toString() : null;
        if (wantsHtml(req)) {
          return page(
            nonceOf(),
            'Uploaded',
            `<h1>Uploaded</h1><p>${esc(doc.filename ?? 'The image')} is in the media library (ID ${esc(String(doc.id))}).</p>
<p>You can close this tab and tell Claude it is done.</p>`,
          );
        }
        return json({ id: doc.id, filename: doc.filename, alt: doc.alt, url, width: doc.width, height: doc.height }, 201);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status && status >= 400 && status < 500) {
          return fail(req, status, err instanceof Error ? err.message : 'The upload was refused.', true);
        }
        payload.logger.error(err, '[media-upload] upload failed');
        return fail(req, 500, 'The upload failed on the server.', true);
      } finally {
        release(grant, succeeded);
      }
    },
  },
];
