import type { CollectionAfterDeleteHook, Payload, PayloadRequest } from 'payload';
import { startOfBerlinDay } from './share/evening';

/**
 * Deleting what we promised to delete (Art. 5(1)(e) and Art. 17 GDPR).
 *
 * - `deleteSubmissionFiles` – a submission takes its uploads (the CV) with it
 *   the moment it is deleted, whether by hand in the admin (a withdrawn
 *   consent: one record, one click) or by the purge below. An upload another
 *   submission still uses stays – the CV the "also apply for membership" box
 *   attached to both an application and a registration, say.
 * - `purgeTechTourRegistrations` – on the day set as "Delete registrations on"
 *   in the TechTour global, every TechTour registration sent before that day
 *   goes, and with it its CV, the host companies' decisions (stored on the
 *   registration) and the host share links of that TechTour (their activity
 *   log goes with them, collections/ShareLinks.ts). Runs at boot and daily
 *   from `onInit`, like the other purges, and also sweeps up any link
 *   activity whose link is gone.
 *
 * Only registrations sent *before* the day are touched, so a stale date can
 * never reach the next TechTour's registrations, and the TechTour global
 * refuses a day before the last evening. Membership applications – including
 * one sent through the TechTour form's "also apply" box – are a different
 * form and are never touched here.
 */

const TECHTOUR_FORM_TITLE = 'techtour';

type FileRef = number | { id: number } | null | undefined;

const fileIds = (files: unknown): number[] =>
  (Array.isArray(files) ? (files as FileRef[]) : [])
    .map((f) => (typeof f === 'object' && f ? f.id : f))
    .filter((id): id is number => Number.isInteger(id));

/** Delete the given uploads unless another submission still uses them. */
async function deleteUnusedFiles(payload: Payload, ids: number[], req?: PayloadRequest): Promise<number> {
  let removed = 0;
  for (const id of ids) {
    const used = await payload.count({
      collection: 'form-submissions',
      where: { files: { equals: id } },
      overrideAccess: true,
      req,
    });
    if (used.totalDocs > 0) continue;
    try {
      await payload.delete({ collection: 'applicant-files', id, overrideAccess: true, req });
      removed += 1;
    } catch (err) {
      // Already gone (deleted by hand) – the orphan purge would catch any
      // other leftover within a day.
      payload.logger.warn({ err, id }, '[retention] could not delete an applicant file');
    }
  }
  return removed;
}

/**
 * `afterDelete` on form-submissions. Runs inside the delete's transaction
 * (`req`), so the count no longer sees the submission being deleted.
 */
export const deleteSubmissionFiles: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await deleteUnusedFiles(req.payload, fileIds((doc as { files?: unknown })?.files), req);
  return doc;
};

/** The id of the form titled "techtour" (the site and the share links find it the same way). */
export async function techTourFormId(payload: Payload): Promise<number | null> {
  const forms = await payload.find({ collection: 'forms', limit: 100, depth: 0, overrideAccess: true });
  return forms.docs.find((f) => f.title?.trim().toLowerCase() === TECHTOUR_FORM_TITLE)?.id ?? null;
}

/**
 * Host link activity whose link no longer exists. Deleting a link takes its
 * activity with it (collections/ShareLinks.ts); this catches what an older
 * version of that left behind, every day.
 */
async function purgeOrphanLinkActivity(payload: Payload): Promise<number> {
  const { docs } = await payload.delete({
    collection: 'share-access-log',
    where: { link: { exists: false } },
    depth: 0,
    overrideAccess: true,
  });
  if (docs.length) payload.logger.info(`[retention] deleted ${docs.length} host link activity entries whose link was gone`);
  return docs.length;
}

export async function purgeTechTourRegistrations(
  payload: Payload,
  now: Date = new Date(),
): Promise<{ registrations: number; links: number } | null> {
  await purgeOrphanLinkActivity(payload);

  const tt = (await payload.findGlobal({ slug: 'tech-tour', depth: 0, overrideAccess: true })) as {
    deleteRegistrationsOn?: string | null;
  };
  const set = tt?.deleteRegistrationsOn ? new Date(tt.deleteRegistrationsOn) : null;
  if (!set || Number.isNaN(set.getTime())) return null;
  // The whole day, in Munich: the first run on that day deletes.
  const cutoff = startOfBerlinDay(set);
  if (now.getTime() < cutoff.getTime()) return null;

  const formId = await techTourFormId(payload);
  if (formId == null) return null;
  const before = cutoff.toISOString();

  const registrations = await payload.delete({
    collection: 'form-submissions',
    where: { and: [{ form: { equals: formId } }, { createdAt: { less_than: before } }] },
    depth: 0,
    overrideAccess: true,
  });
  const links = await payload.delete({
    collection: 'share-links',
    where: { and: [{ form: { equals: formId } }, { createdAt: { less_than: before } }] },
    depth: 0,
    overrideAccess: true,
  });
  for (const { id, message } of [...registrations.errors, ...links.errors]) {
    payload.logger.error(`[retention] could not delete ${id}: ${message}`);
  }

  const result = { registrations: registrations.docs.length, links: links.docs.length };
  if (result.registrations || result.links) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(cutoff);
    payload.logger.info(
      `[retention] deleted ${result.registrations} TechTour registration(s) sent before ${day} and ${result.links} host share link(s)`,
    );
  }
  return result;
}
