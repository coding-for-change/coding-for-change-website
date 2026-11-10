import type { Access, CollectionConfig } from 'payload';
import { contentAccess, hasEditorRole, roleOf } from '../access/roles';

/**
 * Every image uploaded in the admin is stored ready for the web: the original
 * is capped at 2400px on its longer side and re-encoded as WebP, and three
 * smaller WebP renditions are made beside it — thumbnail (400px wide), card
 * (800px) and large (1600px). The site asks for the rendition that fits the
 * slot (`mediaUrl(media, 'card')` in inner/src/api/client.ts) and falls back
 * to the original where a rendition would have been an enlargement. SVGs and
 * videos are stored exactly as uploaded; sharp does not touch them.
 *
 * Images that were in the library before this existed keep their original
 * files until `scripts/reprocess-media.mjs` is run once against the CMS.
 *
 * A new member's photo (POST /api/onboarding/photo, endpoints/onboardingMember.ts)
 * comes in `private` with its `uploadedBy`: only editors, admins and the
 * member themselves can list it or open its files, until it is the image of a
 * published team profile (the Team hook in lib/onboarding/photo.ts keeps that
 * in step). Everything else in the library is public, as before.
 */

/** Editors see the whole library; everyone else what is not private, plus their own uploads. */
const readMedia: Access = ({ req }) => {
  if (hasEditorRole(req.user)) return true;
  const own = roleOf(req.user) && req.user?.id != null ? [{ uploadedBy: { equals: req.user.id } }] : [];
  return { or: [{ private: { equals: false } }, { private: { exists: false } }, ...own] };
};

export const Media: CollectionConfig = {
  slug: 'media',
  access: { ...contentAccess, read: readMedia },
  upload: {
    // HEIC (iPhone camera files) is deliberately left out: the libvips bundled
    // with sharp cannot decode it, so it would be stored untouched and most
    // browsers could not show it. Export as JPEG or PNG first.
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
      'image/svg+xml',
      'video/*',
    ],
    // The stored original: never wider or taller than 2400px, always WebP.
    resizeOptions: { width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true },
    formatOptions: { format: 'webp', options: { quality: 82 } },
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 78 } },
      },
      {
        name: 'card',
        width: 800,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 80 } },
      },
      {
        name: 'large',
        width: 1600,
        withoutEnlargement: true,
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
    ],
    adminThumbnail: 'thumbnail',
    focalPoint: true,
  },
  fields: [
    { name: 'alt', type: 'text', required: true },
    {
      name: 'private',
      type: 'checkbox',
      defaultValue: false,
      // Set by the server only (the member photo endpoint and the Team hook).
      access: { create: () => false, update: () => false },
      admin: {
        position: 'sidebar',
        readOnly: true,
        description:
          'A new member\'s photo: hidden from the public until it is the image of a published team profile.',
      },
    },
    {
      name: 'uploadedBy',
      label: 'Uploaded by member',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      access: { create: () => false, update: () => false },
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'The member who sent this photo with the onboarding form. Empty for everything uploaded in the admin.',
      },
    },
  ],
};
