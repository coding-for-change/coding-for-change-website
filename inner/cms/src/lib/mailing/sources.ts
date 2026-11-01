import type { Payload } from 'payload';
import { poolOf } from '../../endpoints/util';
import type { OptionRow } from '../choiceKeys';
import { eveningsOf, withdrawalsOf } from '../manage/store';
import { membersAmong } from '../members';
import { techTourFormId } from '../retention';
import { eveningsFieldOf } from '../share/evening';
import { SOURCES, type FilterDef, type SourceKey } from './model';
import type { Candidate } from './resolve';

/**
 * Reading the people of a mailing source (lib/mailing/model.ts `SOURCES`) –
 * server-only, read-only. Each entry comes with what the source's filters
 * look at (`props`). Also fills in the filter options that come from the data
 * (the TechTour's evenings).
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

/**
 * Every waitlist signup, oldest first. The list keeps no names, only the
 * address and the site language the person signed up in.
 */
async function waitlist(payload: Payload): Promise<Candidate[]> {
  const { rows } = await poolOf(payload).query(`SELECT id, email, locale FROM waitlist_signups ORDER BY id`);
  return rows.map((r) => {
    const locale = String(r.locale ?? '').trim();
    return {
      waitlistSignup: Number(r.id),
      email: String(r.email ?? ''),
      name: '',
      firstName: '',
      lang: locale === 'de' ? 'de' : 'en',
      props: { language: locale === 'de' || locale === 'en' ? locale : 'unknown' },
    } satisfies Candidate;
  });
}

type TechTourForm = { id: number; field?: string; options: OptionRow[]; optionsDe: OptionRow[] };

/** The TechTour form and its "which evenings" options, in English and German. */
async function techTourForm(payload: Payload): Promise<TechTourForm | null> {
  const id = await techTourFormId(payload);
  if (id == null) return null;
  // One after the other and without a shared req: a local-API read with a locale writes it onto req.
  const en = await payload.findByID({ collection: 'forms', id, depth: 0, locale: 'en', overrideAccess: true });
  const de = await payload.findByID({ collection: 'forms', id, depth: 0, locale: 'de', overrideAccess: true });
  const field = eveningsFieldOf(en.fields as never);
  const fieldDe = eveningsFieldOf(de.fields as never);
  return {
    id,
    field: field?.name,
    options: (field?.options ?? []) as OptionRow[],
    optionsDe: (fieldDe?.options ?? []) as OptionRow[],
  };
}

type RegistrationDoc = {
  id: number;
  language?: 'en' | 'de' | null;
  submissionData?: { field: string; value: unknown }[] | null;
  choiceKeys?: Record<string, unknown> | null;
  hostDecisions?: Record<string, { decision?: string }> | null;
};

/**
 * Every TechTour registration, one entry each (each has its own
 * /techtour/manage link): the evenings it is on now – an evening given up
 * through the link is left out, as on the host's page – what the hosts
 * decided on those, and the member mark.
 */
async function techtour(payload: Payload): Promise<Candidate[]> {
  const form = await techTourForm(payload);
  if (!form) return [];
  const { docs } = (await payload.find({
    collection: 'form-submissions',
    where: { form: { equals: form.id } },
    depth: 0,
    pagination: false,
    sort: 'createdAt',
    overrideAccess: true,
  })) as unknown as { docs: RegistrationDoc[] };
  const ids = docs.map((d) => d.id);
  const [withdrawn, members] = await Promise.all([withdrawalsOf(payload, ids), membersAmong(payload, ids)]);
  return docs.map((d) => {
    const answer = (key: string) =>
      String((d.submissionData ?? []).find((kv) => kv.field.toLowerCase() === key.toLowerCase())?.value ?? '').trim();
    const gaveUp = withdrawn.get(d.id);
    const evenings = form.field
      ? eveningsOf(d as never, form.field, form.options, form.optionsDe).filter((k) => !gaveUp?.has(k))
      : [];
    const decided = (decision: string) =>
      evenings.filter((k) => d.hostDecisions?.[k]?.decision === decision);
    const firstName = answer('firstName');
    return {
      submission: d.id,
      email: answer('email'),
      name: [firstName, answer('lastName')].filter(Boolean).join(' '),
      firstName,
      lang: d.language === 'de' ? 'de' : 'en',
      props: {
        active: evenings.length > 0,
        evening: evenings,
        admitted: decided('admitted'),
        declined: decided('declined'),
        member: members.has(d.id),
        language: d.language === 'de' ? 'de' : 'en',
      },
    } satisfies Candidate;
  });
}

const LOADERS: Record<SourceKey, (payload: Payload) => Promise<Candidate[]>> = { applications, waitlist, techtour };

export const loadSource = (payload: Payload, source: SourceKey): Promise<Candidate[]> => LOADERS[source](payload);

/** A source's filters with the options that come from the data: the TechTour evenings, under their labels. */
export async function filtersOf(payload: Payload, source: SourceKey): Promise<FilterDef[]> {
  const filters = SOURCES[source].filters;
  if (!filters.some((f) => f.kind === 'choice' && f.dynamic)) return filters;
  const form = source === 'techtour' ? await techTourForm(payload) : null;
  const options = (form?.options ?? []).map((o) => ({ value: o.value, label: (o.label ?? '').trim() || o.value }));
  return filters.map((f) => (f.kind === 'choice' && f.dynamic ? { ...f, options } : f));
}
