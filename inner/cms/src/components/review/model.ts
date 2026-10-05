import { pickedKeys, type OptionRow } from '../../lib/choiceKeys';
import { REVIEW_STATUSES } from '../../fields/review';

/**
 * What the review workspace (/admin/review) shows, worked out from the raw
 * REST documents: the person, their answers in the form's order and under the
 * form's labels, their other submissions (same email, any form) and, for a
 * multi-select such as the TechTour evenings, the keys they picked.
 */

export type ReviewStatus = (typeof REVIEW_STATUSES)[number]['value'];

export type FormBlock = {
  id?: string;
  blockType: string;
  name?: string;
  label?: string | null;
  options?: OptionRow[] | null;
  form?: number | { id: number } | null;
};

export type FormDoc = { id: number; title: string; fields?: FormBlock[] | null };

export type FileDoc = {
  id: number;
  filename?: string | null;
  url?: string | null;
  filesize?: number | null;
};

export type Submission = {
  id: number;
  form: number | { id: number };
  createdAt: string;
  submissionData?: { field: string; value: string }[] | null;
  files?: (number | FileDoc)[] | null;
  reviewStatus?: ReviewStatus | null;
  reviewScore?: number | null;
  reviewNotes?: string | null;
  language?: 'en' | 'de' | null;
  choiceKeys?: Record<string, string[]> | null;
};

export const formIdOf = (s: Submission): number =>
  typeof s.form === 'object' && s.form ? s.form.id : (s.form as number);

export const answersOf = (s: Submission): Map<string, string> =>
  new Map((s.submissionData ?? []).map((kv) => [kv.field, String(kv.value ?? '')]));

/** Name and email, whatever the form calls those fields. */
export function personOf(s: Submission): { name: string; email: string } {
  const a = answersOf(s);
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const hit = [...a.entries()].find(([field]) => field.toLowerCase() === k.toLowerCase());
      if (hit?.[1].trim()) return hit[1].trim();
    }
    return '';
  };
  const email = pick('email', 'e-mail');
  const name = [pick('firstName', 'first name'), pick('lastName', 'last name')].filter(Boolean).join(' ') || pick('name');
  return { name: name || email || `Submission ${s.id}`, email };
}

/** Labels in the admin may carry markdown links: "[privacy policy](/privacy)" → "privacy policy". */
export const plainLabel = (label?: string | null): string =>
  (label ?? '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();

export type AnswerRow =
  | { kind: 'short'; name: string; label: string; value: string }
  | { kind: 'long'; name: string; label: string; value: string }
  | { kind: 'choices'; name: string; label: string; values: string[] }
  | { kind: 'confirm'; name: string; label: string; checked: boolean }
  | { kind: 'linked'; name: string; label: string; checked: boolean };

const IDENTITY = new Set(['firstname', 'lastname', 'email', 'e-mail', 'name']);

/**
 * The answers as rows, in the form's current order. A multi-select shows the
 * current labels of the keys picked, so a renamed evening reads the way it is
 * called now; answers to questions the form no longer has come last, under
 * their field names. Name and email are left out (they head the page), and so
 * is the CV (it has its own column).
 */
export function answerRows(form: FormDoc | undefined, s: Submission): AnswerRow[] {
  const answers = answersOf(s);
  const rows: AnswerRow[] = [];
  const seen = new Set<string>();
  for (const block of form?.fields ?? []) {
    if (!block.name || block.blockType === 'message') continue;
    seen.add(block.name);
    if (IDENTITY.has(block.name.toLowerCase()) || block.blockType === 'upload') continue;
    const value = answers.get(block.name);
    const label = plainLabel(block.label) || block.name;
    switch (block.blockType) {
      case 'checkbox':
        rows.push({ kind: 'confirm', name: block.name, label, checked: value === 'true' });
        break;
      case 'subform':
        rows.push({ kind: 'linked', name: block.name, label, checked: value === 'true' });
        break;
      case 'checkboxGroup': {
        const keys = choiceKeysOf(form, s, block.name);
        const values = keys.length
          ? keys.map((k) => plainLabel(block.options?.find((o) => o.value === k)?.label) || k)
          : value
            ? [value]
            : [];
        rows.push({ kind: 'choices', name: block.name, label, values });
        break;
      }
      case 'select': {
        if (value === undefined) break;
        const option = block.options?.find((o) => o.value === value);
        rows.push({ kind: 'short', name: block.name, label, value: plainLabel(option?.label) || value });
        break;
      }
      case 'textarea':
        if (value !== undefined) rows.push({ kind: 'long', name: block.name, label, value });
        break;
      default:
        if (value !== undefined) rows.push({ kind: 'short', name: block.name, label, value });
    }
  }
  for (const [field, value] of answers) {
    if (seen.has(field) || IDENTITY.has(field.toLowerCase()) || !value) continue;
    rows.push({ kind: value.length > 80 ? 'long' : 'short', name: field, label: field, value });
  }
  return rows;
}

/** The option keys picked for a multi-select: as recorded, or read back from the labels for older submissions. */
export function choiceKeysOf(form: FormDoc | undefined, s: Submission, field: string): string[] {
  const recorded = s.choiceKeys?.[field];
  if (Array.isArray(recorded)) return recorded;
  const answer = answersOf(s).get(field);
  const block = form?.fields?.find((b) => b.name === field);
  return answer && block?.options ? pickedKeys(answer, block.options) : [];
}

/** The first multi-select of a form (the TechTour's "which evenings"), for the filter. */
export const choiceFieldOf = (form: FormDoc | undefined): FormBlock | undefined =>
  form?.fields?.find((b) => b.blockType === 'checkboxGroup' && b.name && (b.options?.length ?? 0) > 0);

/** One short line under the name in the list: the first short answer that says something. */
export function summaryOf(form: FormDoc | undefined, s: Submission): string {
  for (const row of answerRows(form, s)) {
    if (row.kind === 'short' && row.value) return row.value;
    if (row.kind === 'choices' && row.values.length) return row.values.join(' · ');
  }
  return '';
}

export const filesOf = (s: Submission, byId: Map<number, FileDoc>): FileDoc[] =>
  (s.files ?? [])
    .map((f) => (typeof f === 'object' && f ? f : byId.get(f as number)))
    .filter((f): f is FileDoc => Boolean(f?.url));

/** Every submission per lower-cased email, newest first, across all forms. */
export function byEmail(all: Submission[]): Map<string, Submission[]> {
  const map = new Map<string, Submission[]>();
  for (const s of all) {
    const email = personOf(s).email.toLowerCase();
    if (!email) continue;
    const list = map.get(email) ?? [];
    list.push(s);
    map.set(email, list);
  }
  return map;
}

export type SortKey = 'newest' | 'oldest' | 'score' | 'name';

export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'score', label: 'Highest score' },
  { key: 'name', label: 'Name (A–Z)' },
];

export function sortSubmissions(list: Submission[], key: SortKey): Submission[] {
  const time = (s: Submission) => new Date(s.createdAt).getTime();
  const sorted = [...list];
  switch (key) {
    case 'oldest':
      return sorted.sort((a, b) => time(a) - time(b));
    case 'score':
      // Unscored last; ties keep the newest first.
      return sorted.sort(
        (a, b) => (b.reviewScore ?? -1) - (a.reviewScore ?? -1) || time(b) - time(a),
      );
    case 'name':
      return sorted.sort((a, b) => personOf(a).name.localeCompare(personOf(b).name, 'de'));
    default:
      return sorted.sort((a, b) => time(b) - time(a));
  }
}
