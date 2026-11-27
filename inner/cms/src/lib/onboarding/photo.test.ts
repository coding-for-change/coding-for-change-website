import { describe, expect, it } from 'vitest';
import { hasPhotoFields, photoVisibility, syncPhotoVisibility } from './photo';

describe('photoVisibility', () => {
  it('shows the image of a published profile and hides it while unpublished', () => {
    expect(photoVisibility({ image: 9, published: true })).toEqual([[9, false]]);
    expect(photoVisibility({ image: { id: 9 }, published: null })).toEqual([[9, false]]);
    expect(photoVisibility({ image: 9, published: false })).toEqual([[9, true]]);
  });

  it('hides an image the profile no longer uses', () => {
    expect(photoVisibility({ image: 12, published: true }, { image: 9 })).toEqual([
      [12, false],
      [9, true],
    ]);
    expect(photoVisibility({ image: null, published: true }, { image: 9 })).toEqual([[9, true]]);
    expect(photoVisibility({ image: 9, published: true }, { image: { id: 9 } })).toEqual([[9, false]]);
  });
});

describe('hasPhotoFields', () => {
  it('tells a whole profile from the fields an update with select returns', () => {
    expect(hasPhotoFields({ id: 1, image: null, published: true })).toBe(true);
    expect(hasPhotoFields({ id: 1, name: 'Louis', companies: [5] })).toBe(false);
    expect(hasPhotoFields({ id: 1, image: 9 })).toBe(false);
  });
});

/** A payload stand-in: member photos by id (uploaded through onboarding unless `admin`), the stored profile. */
function fakeReq(media: Record<number, { private: boolean; admin?: boolean }>, stored: object) {
  const payload = {
    findByID: async ({ collection, id }: { collection: string; id: number }) => {
      if (collection === 'team') return { id, ...stored };
      const m = media[id];
      return m ? { id, private: m.private, uploadedBy: m.admin ? null : 7 } : null;
    },
    update: async ({ id, data }: { id: number; data: { private: boolean } }) => {
      media[id].private = data.private;
      return { id };
    },
  };
  return { payload } as never;
}

const run = (doc: object, previousDoc: object, req: never) =>
  syncPhotoVisibility({ doc, previousDoc, req, collection: {} as never, context: {}, operation: 'update' } as never);

describe('syncPhotoVisibility', () => {
  it('keeps the photo public when an update returns only selected fields', async () => {
    const media = { 109: { private: false } };
    await run({ id: 21, name: 'Louis', companies: [5, 30] }, { id: 21, image: 109, published: true }, fakeReq(media, { image: 109, published: true }));
    expect(media[109].private).toBe(false);
  });

  it('reads the stored profile for a partial update, so a hidden photo of a published profile shows again', async () => {
    const media = { 109: { private: true } };
    await run({ id: 21, companies: [5] }, { id: 21, image: 109, published: true }, fakeReq(media, { image: 109, published: true }));
    expect(media[109].private).toBe(false);
  });

  it('still hides the old photo when it is swapped, and an unpublished profile’s photo', async () => {
    const media = { 109: { private: false }, 120: { private: true } };
    await run({ id: 21, image: 120, published: true }, { id: 21, image: 109, published: true }, fakeReq(media, {}));
    expect(media).toEqual({ 109: { private: true }, 120: { private: false } });

    await run({ id: 21, image: 120, published: false }, { id: 21, image: 120, published: true }, fakeReq(media, {}));
    expect(media[120].private).toBe(true);
  });

  it('never touches media uploaded in the admin', async () => {
    const media = { 50: { private: false, admin: true } };
    await run({ id: 2, image: null, published: true }, { id: 2, image: 50, published: true }, fakeReq(media, {}));
    expect(media[50].private).toBe(false);
  });
});
