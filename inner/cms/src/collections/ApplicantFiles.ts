import type { CollectionConfig } from 'payload';
import { APIError } from 'payload';

/** Hard cap per uploaded document. Mirrored in the inner site's file input hint. */
export const APPLICANT_FILE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Documents uploaded with a form submission: the CV on the membership
 * application, and the optional CV on the TechTour registration. Kept apart
 * from `media` on purpose: `media` is world-readable
 * (it serves the site's images), while these are personal data that only a
 * logged-in admin may open.
 *
 * Flow: the inner site uploads the file here first (anonymous create), gets an
 * id back, and puts that id into the submission's `files` relationship on
 * submit. Files that never make it onto a submission (visitor abandoned the
 * form) are removed by `purgeOrphanApplicantFiles` after 24 hours.
 *
 * Retention of the files that *are* attached follows the submission they hang
 * off, and the two differ: an application's CV goes when the round is decided
 * (six months at the latest), a TechTour registration's within three months of
 * the event week. Both are stated in the Datenschutz — see
 * `scripts/lib/privacyEdits.mjs`, section 5.
 */
export const ApplicantFiles: CollectionConfig = {
  slug: 'applicant-files',
  labels: {
    singular: 'Applicant file',
    plural: 'Applicant files',
  },
  admin: {
    group: 'Forms',
    defaultColumns: ['filename', 'kind', 'filesize', 'createdAt'],
    description:
      'CVs and other documents uploaded with a form submission. Private: only logged-in admins can open them. A file not attached to any submission within 24 hours is deleted automatically.',
  },
  access: {
    // Applicants are anonymous, so anyone may upload…
    create: () => true,
    // …but only admins may see, download, change or delete.
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  upload: {
    // Default storage dir = the collection slug, resolved the same way `media`
    // is — mounted as its own volume in docker-compose so files survive deploys.
    mimeTypes: ['application/pdf'],
  },
  hooks: {
    beforeOperation: [
      ({ args, operation, req }) => {
        if (operation === 'create') {
          const size = req.file?.size;
          if (typeof size === 'number' && size > APPLICANT_FILE_MAX_BYTES) {
            throw new APIError(
              `File too large: the limit is ${Math.round(APPLICANT_FILE_MAX_BYTES / 1024 / 1024)} MB.`,
              413,
            );
          }
        }
        return args;
      },
    ],
  },
  fields: [
    {
      name: 'kind',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Which form field the file was uploaded for (e.g. "cv").',
      },
    },
  ],
};
