import type { Payload } from 'payload';
import { poolOf } from '../../endpoints/util';
import type { SourceKey } from './model';
import type { Candidate } from './resolve';

/**
 * Reading the people of a mailing source (lib/mailing/model.ts `SOURCES`) –
 * server-only, read-only. Each entry comes with what the source's filters
 * look at (`props`).
 */

/** The membership application is the form titled "application" (as on /join/apply). */
const APPLICATION_FORM_TITLE = 'application';

async function formIdByTitle(payload: Payload, title: string): Promise<number | null> {
  const forms = await payload.find({ collection: 'forms', limit: 100, depth: 0, overrideAccess: true });
  return forms.docs.find((f) => f.title?.trim().toLowerCase() === title)?.id ?? null;
}

/**
 * Every membership application: name and address from the answers, and the
 * review (decision, score), whether it came through /join/speedrun and the
 * language it was sent in. Submissions from before the language was recorded
 * are written to in English, like their confirmation was.
 */
async function applications(payload: Payload): Promise<Candidate[]> {
  const formId = await formIdByTitle(payload, APPLICATION_FORM_TITLE);
  if (formId == null) return [];
  const { rows } = await poolOf(payload).query(
    `SELECT s.id, s.review_status, s.review_score, s.source, s.language,
            max(CASE WHEN d.field = 'email' THEN d.value END) AS email,
            max(CASE WHEN d.field = 'firstName' THEN d.value END) AS first_name,
            max(CASE WHEN d.field = 'lastName' THEN d.value END) AS last_name
     FROM form_submissions s
     LEFT JOIN form_submissions_submission_data d
       ON d._parent_id = s.id AND d.field IN ('email', 'firstName', 'lastName')
     WHERE s.form_id = $1
     GROUP BY s.id
     ORDER BY s.id`,
    [formId],
  );
  return rows.map((r) => {
    const firstName = String(r.first_name ?? '').trim();
    const name = [firstName, String(r.last_name ?? '').trim()].filter(Boolean).join(' ');
    const score = r.review_score == null ? null : Number(r.review_score);
    return {
      submission: Number(r.id),
      email: String(r.email ?? ''),
      name,
      firstName,
      lang: r.language === 'de' ? 'de' : 'en',
      props: {
        status: String(r.review_status ?? 'unreviewed'),
        score: Number.isFinite(score) ? score : null,
        speedrun: r.source === 'speedrun',
        language: r.language === 'de' ? 'de' : 'en',
      },
    } satisfies Candidate;
  });
}

const LOADERS: Record<SourceKey, (payload: Payload) => Promise<Candidate[]>> = { applications };

export const loadSource = (payload: Payload, source: SourceKey): Promise<Candidate[]> => LOADERS[source](payload);
