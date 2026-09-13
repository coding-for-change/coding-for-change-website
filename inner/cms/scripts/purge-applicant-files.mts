/**
 * One-off: remove applicant uploads that were never attached to a submission.
 * The CMS does this itself at boot and daily (see onInit in payload.config.ts);
 * this is for running it by hand, e.g. `pnpm payload run scripts/purge-applicant-files.mts`.
 * Pass MAX_AGE_HOURS=0 to purge every unattached file regardless of age.
 */
import { getPayload } from 'payload';
import config from '../src/payload.config';
import { purgeOrphanApplicantFiles } from '../src/lib/purgeApplicantFiles';

const payload = await getPayload({ config });
const hours = Number(process.env.MAX_AGE_HOURS ?? '24');
const removed = await purgeOrphanApplicantFiles(payload, hours);
console.log(`purged ${removed} orphaned applicant file(s) older than ${hours}h`);
process.exit(0);
