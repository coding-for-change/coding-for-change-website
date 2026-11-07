import type { Endpoint } from 'payload';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readDownloadToken } from '../lib/applicantFileLink';

/**
 * The CV download links the MCP tool `createApplicantFileDownloadUrl` hands
 * out (lib/mcpAdmin.ts, lib/applicantFileLink.ts) – a public route, guarded by
 * nothing but the signed token:
 *
 *   GET /api/applicant-file/:token   the PDF
 *
 * Before the file goes out, the MCP key in the token must still exist, still
 * belong to the same user, still have "Applicant files → find" and the tool
 * ticked. Answers `no-store`, `noindex`, `no-referrer`.
 */

const PRIVATE = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: PRIVATE });

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v);

const download: Endpoint = {
  path: '/applicant-file/:token',
  method: 'get',
  handler: async (req) => {
    const grant = readDownloadToken(String(req.routeParams?.token ?? ''));
    if (!grant) return fail(404, 'This link is invalid or has expired. Ask for a new one.');

    const key = (await req.payload
      .findByID({ collection: 'payload-mcp-api-keys', id: grant.keyId, depth: 0, overrideAccess: true })
      .catch(() => null)) as Record<string, unknown> | null;
    const tools = key?.['payload-mcp-tool'] as Record<string, unknown> | undefined;
    const files = key?.applicantFiles as Record<string, unknown> | undefined;
    if (
      !key ||
      String(idOf(key.user)) !== String(grant.userId) ||
      files?.find !== true ||
      tools?.createApplicantFileDownloadUrl !== true
    ) {
      return fail(403, 'This MCP key may no longer read applicant files.');
    }

    const file = await req.payload
      .findByID({ collection: 'applicant-files', id: grant.fileId, depth: 0, overrideAccess: true })
      .catch(() => null);
    if (!file?.filename) return fail(404, 'No such file.');
    const dir = req.payload.collections['applicant-files'].config.upload.staticDir as string;
    let data: Buffer;
    try {
      data = await readFile(path.resolve(dir, path.basename(file.filename)));
    } catch {
      return fail(404, 'The file could not be opened.');
    }
    req.payload.logger.info(`[applicant-file] file ${grant.fileId} downloaded with MCP key ${grant.keyId}`);
    const name = path.basename(file.filename).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
    return new Response(new Uint8Array(data), {
      headers: {
        ...PRIVATE,
        'Content-Type': file.mimeType || 'application/pdf',
        'Content-Disposition': `attachment; filename="${name}"`,
      },
    });
  },
};

export const applicantFileLinkEndpoints: Endpoint[] = [download];
