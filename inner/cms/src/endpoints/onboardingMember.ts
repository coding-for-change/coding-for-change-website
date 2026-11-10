import { addDataAndFileToRequest, type Endpoint, type PayloadRequest } from 'payload';
import { roleOf } from '../access/roles';
import { checkImage, safeFilename } from '../lib/mediaUpload';
import { memberView } from '../lib/onboarding/member';
import { notifyIfStepsDone } from '../lib/onboarding/notify';
import { PHOTO_MAX_BYTES, replacePendingPhotos } from '../lib/onboarding/photo';
import { setCheck } from '../lib/onboarding/store';

/**
 * The member's own onboarding page (/onboarding on the public site). Any
 * signed-in `users` account (a member, or a board member trying the page),
 * and always that account only: no endpoint here takes an account id, so
 * nobody can read or change anyone else's onboarding through them.
 *
 *   GET  /api/onboarding/me?locale=de|en
 *        → MemberOnboardingView (lib/onboarding/types.ts)
 *   POST /api/onboarding/me/check  { item, done, locale? }
 *        → MemberOnboardingView, with the to-do ticked or unticked
 *   POST /api/onboarding/photo     multipart/form-data, field "file"
 *        → 201 { id, filename, url, thumbnailUrl, width, height }
 *
 * The photo is the one the onboarding form's image question sends
 * (components/forms/CmsForm.tsx): checked from its bytes (JPEG, PNG, WebP or
 * GIF, lib/mediaUpload.ts), at most 5 MB, stored in `media` as private to the
 * member (lib/onboarding/photo.ts). Each upload replaces the member's earlier
 * photo that no profile uses, and there are at most PHOTO_UPLOADS_PER_HOUR
 * per member, so nobody fills the library.
 *
 * 401 without a sign-in. Every answer is `Cache-Control: no-store`.
 */

const NO_STORE = { 'Cache-Control': 'no-store, private' };
const PHOTO_UPLOADS_PER_HOUR = 10;
/** Multipart framing around the file. */
const MAX_BODY_BYTES = PHOTO_MAX_BYTES + 64 * 1024;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });
const fail = (status: number, error: string) => json({ error }, status);

/** The caller's own account id, or null when it is not a signed-in `users` account. */
function selfOf(req: PayloadRequest): number | null {
  if (roleOf(req.user) === null) return null;
  const id = Number(req.user?.id);
  return Number.isInteger(id) ? id : null;
}

const localeOf = (v: unknown): 'en' | 'de' => (v === 'de' ? 'de' : 'en');

async function readBody<T>(req: PayloadRequest): Promise<T | null> {
  try {
    return ((await req.json?.()) ?? {}) as T;
  } catch {
    return null;
  }
}

// ---- upload rate, per member, in this process ------------------------------

const uploads = new Map<number, number[]>();

function underRate(user: number): boolean {
  const now = Date.now();
  const recent = (uploads.get(user) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  uploads.set(user, recent);
  return recent.length < PHOTO_UPLOADS_PER_HOUR;
}

function countUpload(user: number): void {
  uploads.set(user, [...(uploads.get(user) ?? []), Date.now()]);
}

// ---- endpoints ---------------------------------------------------------------

const me: Endpoint = {
  path: '/onboarding/me',
  method: 'get',
  handler: async (req) => {
    const self = selfOf(req);
    if (self === null) return fail(401, 'Please sign in.');
    return json(await memberView(req, self, localeOf(req.searchParams.get('locale'))));
  },
};

const check: Endpoint = {
  path: '/onboarding/me/check',
  method: 'post',
  handler: async (req) => {
    const self = selfOf(req);
    if (self === null) return fail(401, 'Please sign in.');
    const body = await readBody<{ item?: unknown; done?: unknown; locale?: unknown }>(req);
    const item = typeof body?.item === 'string' ? body.item : '';
    if (!body || !item || typeof body.done !== 'boolean') {
      return fail(400, 'Expected { item: to-do id, done: true | false }.');
    }
    const locale = localeOf(body.locale);
    // The wording as the member sees it on their page, in their language.
    const before = await memberView(req, self, locale);
    const todo = before.todos.find((t) => t.id === item);
    if (!todo) return fail(404, 'No such to-do (any more). Reload the page.');
    if (todo.done !== body.done) {
      await setCheck(req.payload, {
        user: self,
        kind: 'member',
        item,
        text: todo.text,
        linkUrl: todo.linkUrl,
        done: body.done,
        by: String((req.user as { email?: string }).email ?? self),
        locale,
      });
      if (body.done) await notifyIfStepsDone(req, self);
    }
    return json(await memberView(req, self, locale));
  },
};

const photo: Endpoint = {
  path: '/onboarding/photo',
  method: 'post',
  handler: async (req) => {
    const self = selfOf(req);
    if (self === null) return fail(401, 'Please sign in.');
    const { payload } = req;

    // Refuse oversized or unframed bodies before reading a byte of them.
    const length = Number(req.headers.get('content-length') ?? NaN);
    if (!Number.isFinite(length) || length <= 0) return fail(411, 'Send the photo with a Content-Length.');
    if (length > MAX_BODY_BYTES) return fail(413, 'The photo is larger than 5 MB.');
    if (!(req.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
      return fail(415, 'Send the photo as multipart/form-data in a field named "file".');
    }
    if (!underRate(self)) return fail(429, 'Too many uploads. Please try again in an hour.');

    await addDataAndFileToRequest(req);
    const file = req.file;
    if (!file?.data?.length) return fail(400, 'No file in the field "file".');
    if (file.data.length > PHOTO_MAX_BYTES) return fail(413, 'The photo is larger than 5 MB.');
    const image = await checkImage(file.data);
    if ('error' in image) return fail(415, image.error);
    countUpload(self);

    const account = (await payload.findByID({ collection: 'users', id: self, depth: 0, overrideAccess: true, req })) as {
      firstName?: string | null;
      lastName?: string | null;
      email: string;
    };
    const name = [account.firstName, account.lastName].filter(Boolean).join(' ').trim() || account.email.split('@')[0];

    try {
      await replacePendingPhotos(payload, self, req);
      const doc = (await payload.create({
        collection: 'media',
        data: { alt: `Photo of ${name}`, private: true, uploadedBy: self },
        file: {
          data: file.data,
          mimetype: image.mimetype,
          // Not the name it came with: that stays on the member's device.
          name: safeFilename(`member-${self}-photo`, image.ext),
          size: file.data.length,
        },
        depth: 0,
        overrideAccess: true,
        req,
      })) as {
        id: number;
        filename?: string | null;
        url?: string | null;
        width?: number | null;
        height?: number | null;
        sizes?: { thumbnail?: { url?: string | null } | null } | null;
      };
      payload.logger.info(`[onboarding] photo media ${doc.id} uploaded by user ${self}`);
      return json(
        {
          id: doc.id,
          filename: doc.filename ?? null,
          url: doc.url ?? null,
          thumbnailUrl: doc.sizes?.thumbnail?.url ?? doc.url ?? null,
          width: doc.width ?? null,
          height: doc.height ?? null,
        },
        201,
      );
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status && status >= 400 && status < 500) {
        return fail(status, err instanceof Error ? err.message : 'The upload was refused.');
      }
      payload.logger.error(err, '[onboarding] photo upload failed');
      return fail(500, 'The upload failed on the server.');
    }
  },
};

export const onboardingMemberEndpoints: Endpoint[] = [me, check, photo];
