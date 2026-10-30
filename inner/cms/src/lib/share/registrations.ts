import type { Payload, PayloadRequest } from 'payload';
import { pickedKeys } from '../choiceKeys';
import { withdrawnFrom } from '../manage/store';
import { consentedToSharing } from '../sharingConsent';
import { eveningOf, eveningsFieldOf, type Evening } from './evening';

/**
 * What a host company sees through its share link, and nothing more: the
 * registrations for its evening whose sender agreed to it, each with the name,
 * the CV and the other answers to the form's own questions (e.g. university).
 * Never the email address, the other evenings a person picked, their ticks,
 * our review, or anything about a membership application (Datenschutz
 * section 5a).
 *
 * "Agreed to it" means the ticked `hostSharing` box in the registration's own
 * record (lib/sharingConsent.ts) – the consent to pass the registration on to
 * the host companies of the evenings picked. A registration without it (sent
 * before the box existed, or posted around the form) is not shown, cannot be
 * decided on, and its CV cannot be opened through the link.
 *
 * Nor is anyone who gave the evening up through their own link
 * (/techtour/manage, lib/manage/store.ts): the registration still carries the
 * evening, the withdrawal is a row of its own, and it is left out here.
 *
 * Also records the host's decision on a registration, under the evening's key
 * in the submission's `hostDecisions` – so it is deleted together with the
 * registration.
 */

export type HostDecision = 'admitted' | 'declined';
export type HostDecisions = Record<string, { decision: HostDecision; by: string; at: string }>;

export type ShareLinkDoc = {
  id: number;
  title: string;
  option: string;
  form?: number | { id: number } | null;
  recipients?: { email: string; name?: string | null }[] | null;
  expiresAt?: string | null;
  blocked?: boolean | null;
  token?: string | null;
};

export type HostRow = {
  id: number;
  name: string;
  registeredAt: string;
  details: { label: string; value: string }[];
  hasCv: boolean;
  decision: HostDecision | null;
};

type Block = {
  blockType: string;
  name?: string;
  label?: string | null;
  options?: { label?: string | null; value: string }[] | null;
};

type SubmissionDoc = {
  id: number;
  form: number | { id: number };
  createdAt: string;
  submissionData?: { field: string; value: string }[] | null;
  files?: (number | { id: number })[] | null;
  choiceKeys?: Record<string, string[]> | null;
  agreedTo?: { field: string }[] | null;
  hostDecisions?: HostDecisions | null;
};

/** Questions whose answers a host may see: the person's own words, not their contact data. */
const SHOWN = new Set(['text', 'textarea', 'select', 'number']);
const PERSONAL = /^(e-?mail|phone|telefon|first\s*name|last\s*name|firstname|lastname|name)$/i;

const formIdOf = (link: ShareLinkDoc) => (typeof link.form === 'object' && link.form ? link.form.id : (link.form as number));

export const isRecipient = (link: ShareLinkDoc, email: string) =>
  (link.recipients ?? []).some((r) => r.email.trim().toLowerCase() === email.trim().toLowerCase());

type Scope = {
  evening: Evening;
  fields: Block[];
  /** The evenings' options in both languages, for registrations older than `choiceKeys`. */
  options: { en: Block['options']; de: Block['options'] };
};

async function scopeOf(payload: Payload, link: ShareLinkDoc, req?: PayloadRequest): Promise<Scope | null> {
  const formId = formIdOf(link);
  if (formId == null) return null;
  const evening = await eveningOf(payload, formId, link.option, req);
  if (!evening) return null;
  // Not with `req`: a local-API call with a `locale` writes it onto the
  // request, so two of them in parallel on one `req` both read the language
  // set last – the host's (English) page came out with the German labels.
  const [en, de] = await Promise.all(
    (['en', 'de'] as const).map((locale) =>
      payload.findByID({ collection: 'forms', id: formId, depth: 0, locale }).catch(() => null),
    ),
  );
  const fields = (en?.fields ?? []) as Block[];
  return {
    evening,
    fields,
    options: {
      en: eveningsFieldOf(fields)?.options ?? [],
      de: eveningsFieldOf((de?.fields ?? []) as Block[])?.options ?? [],
    },
  };
}

const inScope = (scope: Scope, s: SubmissionDoc): boolean => {
  if (!consentedToSharing(s)) return false;
  const recorded = s.choiceKeys?.[scope.evening.field];
  if (Array.isArray(recorded)) return recorded.includes(scope.evening.option);
  const answer = (s.submissionData ?? []).find((kv) => kv.field === scope.evening.field)?.value ?? '';
  return [scope.options.en, scope.options.de].some((opts) => pickedKeys(answer, opts ?? []).includes(scope.evening.option));
};

const rowOf = (scope: Scope, s: SubmissionDoc): HostRow => {
  const answers = new Map((s.submissionData ?? []).map((kv) => [kv.field, String(kv.value ?? '')]));
  const details: HostRow['details'] = [];
  for (const block of scope.fields) {
    if (!block.name || !SHOWN.has(block.blockType) || PERSONAL.test(block.name)) continue;
    const value = answers.get(block.name)?.trim();
    if (!value) continue;
    const label = (block.label || block.name).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    const shown = block.blockType === 'select' ? (block.options?.find((o) => o.value === value)?.label ?? value) : value;
    details.push({ label, value: shown });
  }
  const name = [answers.get('firstName'), answers.get('lastName')].filter((x) => x?.trim()).join(' ').trim();
  return {
    id: s.id,
    name: name || `Registration ${s.id}`,
    registeredAt: s.createdAt,
    details,
    hasCv: (s.files ?? []).length > 0,
    decision: s.hostDecisions?.[scope.evening.option]?.decision ?? null,
  };
};

async function registrationsOf(
  payload: Payload,
  link: ShareLinkDoc,
  req?: PayloadRequest,
): Promise<{ scope: Scope; docs: SubmissionDoc[] } | null> {
  const scope = await scopeOf(payload, link, req);
  if (!scope) return null;
  const { docs } = await payload.find({
    collection: 'form-submissions',
    where: { form: { equals: formIdOf(link) } },
    depth: 0,
    pagination: false,
    sort: 'createdAt',
    overrideAccess: true,
    req,
  });
  const shown = (docs as unknown as SubmissionDoc[]).filter((s) => inScope(scope, s));
  const withdrawn = await withdrawnFrom(payload, scope.evening.option, shown.map((s) => s.id));
  return { scope, docs: shown.filter((s) => !withdrawn.has(s.id)) };
}

/** Everyone registered for the link's evening, first come first. */
export async function hostView(
  payload: Payload,
  link: ShareLinkDoc,
  req?: PayloadRequest,
): Promise<{ evening: Evening; rows: HostRow[] } | null> {
  const found = await registrationsOf(payload, link, req);
  return found && { evening: found.scope.evening, rows: found.docs.map((s) => rowOf(found.scope, s)) };
}

/** Every CV on the link's list at once (the page's "Download CVs"), numbered as on the page. */
export async function hostCvs(
  payload: Payload,
  link: ShareLinkDoc,
  req?: PayloadRequest,
): Promise<{ n: number; row: HostRow; file: number }[] | null> {
  const found = await registrationsOf(payload, link, req);
  return (
    found &&
    found.docs.flatMap((s, i) => {
      const file = cvOf(s);
      return file == null ? [] : [{ n: i + 1, row: rowOf(found.scope, s), file }];
    })
  );
}

/** A registration the link may act on, or null when it is not one of its evening's. */
export async function registrationInScope(
  payload: Payload,
  link: ShareLinkDoc,
  id: number,
  req?: PayloadRequest,
): Promise<{ scope: Scope; doc: SubmissionDoc } | null> {
  const scope = await scopeOf(payload, link, req);
  if (!scope || !Number.isInteger(id)) return null;
  const doc = (await payload
    .findByID({ collection: 'form-submissions', id, depth: 0, overrideAccess: true, req })
    .catch(() => null)) as SubmissionDoc | null;
  if (!doc) return null;
  const docForm = typeof doc.form === 'object' && doc.form ? doc.form.id : doc.form;
  if (docForm !== formIdOf(link) || !inScope(scope, doc)) return null;
  const withdrawn = await withdrawnFrom(payload, scope.evening.option, [doc.id]);
  return withdrawn.has(doc.id) ? null : { scope, doc };
}

/** Record (or with null, take back) the host's decision on one registration. */
export async function decide(
  payload: Payload,
  link: ShareLinkDoc,
  id: number,
  decision: HostDecision | null,
  by: string,
  req?: PayloadRequest,
): Promise<boolean> {
  const found = await registrationInScope(payload, link, id, req);
  if (!found) return false;
  const next: HostDecisions = { ...(found.doc.hostDecisions ?? {}) };
  if (decision) next[found.scope.evening.option] = { decision, by, at: new Date().toISOString() };
  else delete next[found.scope.evening.option];
  await payload.update({
    collection: 'form-submissions',
    id,
    data: { hostDecisions: next },
    overrideAccess: true,
    req,
  });
  return true;
}

/** The first file of a registration (its CV), for the link's CV route. */
export const cvOf = (doc: SubmissionDoc): number | null => {
  const first = (doc.files ?? [])[0];
  return first == null ? null : typeof first === 'object' ? first.id : first;
};
