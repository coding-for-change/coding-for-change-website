import type { PayloadRequest } from 'payload';
import type { MCPAccessSettings, mcpPlugin } from '@payloadcms/plugin-mcp';
import { z } from 'zod';
import {
  ALLOWED_TYPES,
  MAX_ALT_LENGTH,
  MAX_UPLOAD_BYTES,
  UPLOAD_MINUTES,
  issueUploadToken,
  siteOrigin,
} from './mediaUpload';

type PluginOptions = Parameters<typeof mcpPlugin>[0];
type CustomTool = NonNullable<NonNullable<PluginOptions['mcp']>['tools']>[number];

/**
 * The plugin hands its own tools the API key's user, but custom tools only get
 * the request. `rememberMcpKey` (the plugin's `overrideAuth`) keeps the key
 * that authenticated each /api/mcp request, so a custom tool can see who is
 * calling and what that key may do. Authentication itself is unchanged – it
 * is the plugin's default Bearer-key check.
 */
const keyOfRequest = new WeakMap<PayloadRequest, MCPAccessSettings>();

export const rememberMcpKey: NonNullable<PluginOptions['overrideAuth']> = async (req, getDefaultMcpAccessSettings) => {
  const settings = await getDefaultMcpAccessSettings();
  keyOfRequest.set(req, settings);
  return settings;
};

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });

const idOf = (v: unknown): number | string | null => {
  const id = v && typeof v === 'object' ? (v as { id?: unknown }).id : v;
  return typeof id === 'number' || (typeof id === 'string' && id) ? id : null;
};

/**
 * `createMediaUploadUrl` – a one-time link to upload an image into Media
 * (lib/mediaUpload.ts, endpoints/mediaUpload.ts). Only for keys that may
 * create media; each key also has its own on/off box for this tool in the
 * admin ("Tools" in the key's sidebar).
 */
export const mediaUploadTool: CustomTool = {
  name: 'createMediaUploadUrl',
  description: [
    'Get a one-time URL to upload an image file (e.g. a team photo, sponsor logo) into the Media collection.',
    'MCP arguments cannot carry files, so: call this with the alt text, then POST the file to the returned URL',
    'as multipart/form-data with the field name "file" – from your code sandbox with curl.',
    'The response is JSON with the new media "id"; link it afterwards, e.g. updateTeam with "image" set to that id.',
    `JPEG, PNG, WebP or GIF only, max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    'SVG (e.g. a logo) is refused because it can carry scripts: convert it to PNG in your sandbox first, about 1600 px wide',
    '(e.g. `rsvg-convert -w 1600 logo.svg -o logo.png`, or Python `cairosvg.svg2png(url="logo.svg", write_to="logo.png", output_width=1600)`).',
    'HEIC: convert to JPEG first.',
    `The URL is valid for ${UPLOAD_MINUTES} minutes and one successful upload. If your sandbox cannot reach the site,`,
    'give the URL to the user: opened in a browser it shows an upload form.',
  ].join(' '),
  parameters: {
    alt: z
      .string()
      .min(1)
      .max(MAX_ALT_LENGTH)
      .describe('Alt text for the image (required by the Media collection), e.g. "Portrait of Jane Doe".'),
  },
  handler: async (args, req) => {
    const key = keyOfRequest.get(req);
    const keyId = idOf(key);
    const userId = idOf(key?.user);
    if (!key || keyId == null || userId == null) return text('Error: could not identify the MCP API key for this request.');
    const media = key.media as { create?: boolean } | undefined;
    if (media?.create !== true) {
      return text('Error: this MCP API key may not create media. An admin can tick "Media → create" on the key.');
    }
    // eslint-disable-next-line no-control-regex
    const alt = String(args.alt ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
    if (!alt || alt.length > MAX_ALT_LENGTH) return text(`Error: alt text must be 1–${MAX_ALT_LENGTH} characters.`);

    const { token, expires } = issueUploadToken({ keyId, userId, alt });
    const url = `${siteOrigin()}/api/media-upload/${token}`;
    req.payload.logger.info(`[media-upload] link issued for MCP key ${keyId} (user ${userId})`);
    return text(
      [
        `Upload URL (valid until ${new Date(expires).toISOString()}, one successful upload):`,
        url,
        '',
        'From your code sandbox:',
        `curl -sS -F "file=@/path/to/image.jpg" "${url}"`,
        '',
        'Success returns JSON like {"id": 123, "filename": "...", "url": "..."}.',
        `Accepted: ${ALLOWED_TYPES.join(', ')}. If the sandbox cannot reach ${new URL(siteOrigin()).host},`,
        'give the user this URL – it shows an upload form in a browser.',
      ].join('\n'),
    );
  },
};
