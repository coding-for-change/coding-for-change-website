import type { Payload } from 'payload';

/**
 * Delete `applicant-files` that were uploaded but never attached to a form
 * submission — a visitor picked a CV and then left the page. Anyone may upload
 * (applicants are anonymous), so without this the store would fill with files
 * nobody can account for, and each one is personal data we have no purpose to
 * keep. Runs at boot and daily from `onInit`, like the analytics purge.
 *
 * Files that ARE attached to a submission are left alone; their retention
 * follows the application itself.
 */
export async function purgeOrphanApplicantFiles(
  payload: Payload,
  maxAgeHours = 24,
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  const stale = await payload.find({
    collection: 'applicant-files',
    where: { createdAt: { less_than: cutoff.toISOString() } },
    depth: 0,
    limit: 500,
    overrideAccess: true,
  });

  let removed = 0;
  for (const file of stale.docs) {
    const used = await payload.count({
      collection: 'form-submissions',
      where: { files: { equals: file.id } },
      overrideAccess: true,
    });
    if (used.totalDocs > 0) continue;
    await payload.delete({
      collection: 'applicant-files',
      id: file.id,
      overrideAccess: true,
    });
    removed += 1;
  }

  if (removed > 0) {
    payload.logger.info(
      `[applicant-files] purged ${removed} orphaned upload(s) older than ${maxAgeHours}h`,
    );
  }
  return removed;
}
