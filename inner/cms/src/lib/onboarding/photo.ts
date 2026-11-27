import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, Payload, PayloadRequest } from 'payload';

/**
 * A new member's photo: uploaded on their onboarding page
 * (POST /api/onboarding/photo, endpoints/onboardingMember.ts) into `media`,
 * `private` and with `uploadedBy` set, so nobody but the member, editors and
 * admins can see it (collections/Media.ts).
 *
 * It becomes public only as the image of a published team profile, and
 * private again when that profile is unpublished or deleted or the image is
 * swapped: the Team hooks below keep `media.private` in step, whoever changes
 * the profile (the dashboard's "Publish profile", an editor under Team, the
 * onboarding form). Media uploaded in the admin has no `uploadedBy` and is
 * never touched.
 *
 * A member has at most two photos at any time: the one on their profile and
 * one sent since. `replacePendingPhotos` runs before every upload and
 * `removeUnusedPhotos` after every onboarding form, so a member cannot fill
 * the library by uploading again and again (the endpoint also limits the
 * size and the rate).
 */

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const idOf = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === 'object') return idOf((v as { id?: unknown }).id);
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

type MediaDoc = { id: number; uploadedBy?: unknown; private?: boolean | null };

async function memberPhoto(payload: Payload, id: number, req?: PayloadRequest): Promise<MediaDoc | null> {
  const doc = (await payload
    .findByID({ collection: 'media', id, depth: 0, overrideAccess: true, req })
    .catch(() => null)) as MediaDoc | null;
  return doc && idOf(doc.uploadedBy) !== null ? doc : null;
}

async function setPrivate(payload: Payload, id: number | null, hidden: boolean, req?: PayloadRequest): Promise<void> {
  if (id === null) return;
  const doc = await memberPhoto(payload, id, req);
  if (!doc || Boolean(doc.private) === hidden) return;
  await payload.update({ collection: 'media', id, data: { private: hidden }, depth: 0, overrideAccess: true, req });
}

type ProfileFields = { id?: unknown; image?: unknown; published?: boolean | null };

/**
 * What a saved profile means for its photos: the current image is hidden
 * exactly while the profile is unpublished, and an image it no longer uses
 * goes back to private. Pairs of [media id, hidden].
 */
export function photoVisibility(profile: ProfileFields, previous?: ProfileFields | null): [number, boolean][] {
  const image = idOf(profile.image);
  const before = idOf(previous?.image);
  const changes: [number, boolean][] = [];
  if (image !== null) changes.push([image, profile.published === false]);
  if (before !== null && before !== image) changes.push([before, true]);
  return changes;
}

/**
 * Whether the hook was handed the whole profile. An update with `select`
 * (e.g. over MCP) passes only the selected fields: a missing `image` would
 * read as a removed photo and hide it from the site.
 */
export const hasPhotoFields = (doc: object): boolean => 'image' in doc && 'published' in doc;

/** Team afterChange: a member photo is public exactly while it is the image of a published profile. */
export const syncPhotoVisibility: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const profile: ProfileFields = hasPhotoFields(doc)
    ? doc
    : await req.payload.findByID({ collection: 'team', id: doc.id, depth: 0, overrideAccess: true, req });
  for (const [id, hidden] of photoVisibility(profile, previousDoc)) await setPrivate(req.payload, id, hidden, req);
  return doc;
};

/** Team afterDelete: the photo of a deleted profile goes back to private. */
export const hidePhotoOfDeletedProfile: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await setPrivate(req.payload, idOf((doc as { image?: unknown }).image), true, req);
  return doc;
};

/** Photo ids this member uploaded, newest first. */
async function photosOf(payload: Payload, user: number, req?: PayloadRequest): Promise<number[]> {
  const found = await payload.find({
    collection: 'media',
    where: { uploadedBy: { equals: user } },
    depth: 0,
    pagination: false,
    sort: '-createdAt',
    select: { filename: true },
    overrideAccess: true,
    req,
  });
  return found.docs.map((d) => d.id as number);
}

/** Media ids used as the image of any team entry, out of `ids`. */
async function usedByTeam(payload: Payload, ids: number[], req?: PayloadRequest): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const found = await payload.find({
    collection: 'team',
    where: { image: { in: ids } },
    depth: 0,
    pagination: false,
    select: { image: true },
    overrideAccess: true,
    req,
  });
  return new Set(found.docs.map((d) => idOf((d as { image?: unknown }).image)).filter((v): v is number => v !== null));
}

async function remove(payload: Payload, ids: number[], req?: PayloadRequest): Promise<void> {
  for (const id of ids) {
    await payload.delete({ collection: 'media', id, overrideAccess: true, req }).catch((err: Error) =>
      payload.logger.warn(`[onboarding] could not delete member photo ${id}: ${err.message}`),
    );
  }
}

/** Before a new upload: the member's photos that no profile uses go (the one they sent before). */
export async function replacePendingPhotos(payload: Payload, user: number, req?: PayloadRequest): Promise<void> {
  const mine = await photosOf(payload, user, req);
  const used = await usedByTeam(payload, mine, req);
  await remove(payload, mine.filter((id) => !used.has(id)), req);
}

/** After an onboarding form: every photo of the member except `keep` that no profile uses goes. */
export async function removeUnusedPhotos(payload: Payload, user: number, keep: number | null, req?: PayloadRequest): Promise<void> {
  const mine = (await photosOf(payload, user, req)).filter((id) => id !== keep);
  const used = await usedByTeam(payload, mine, req);
  await remove(payload, mine.filter((id) => !used.has(id)), req);
}

/** Whether `photo` is a photo this member uploaded (and so may put on their profile). */
export async function isOwnPhoto(payload: Payload, user: number, photo: number, req?: PayloadRequest): Promise<boolean> {
  const doc = await memberPhoto(payload, photo, req);
  return doc !== null && idOf(doc.uploadedBy) === user;
}
