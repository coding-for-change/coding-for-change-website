import type { CollectionBeforeChangeHook, Field } from 'payload';
import { createHash } from 'node:crypto';
import { pickedKeys, type OptionRow } from '../lib/choiceKeys';

/**
 * What a submission records about itself when it arrives, beyond the answers:
 * the language it was sent in, the exact wording of every box the person
 * ticked, and the stable keys of the options they picked.
 *
 * The answers alone are not enough to stand on later. A ticked box is stored
 * as "true" – what was agreed lives in the form's label, which an editor can
 * change in the admin the next day. A multi-select answer stores the option
 * labels as shown ("Tue 10 Nov · Lio"), in the visitor's language, and those
 * stop matching as soon as a "to be announced" evening gets its company. So
 * both are copied out of the form once, on create, in the submission's
 * language; nothing writes them afterwards – the API cannot either (field
 * access), so the record stands as proof of consent (Art. 7(1) GDPR): when,
 * which wording, which version of it, and which evenings.
 */

export const SUBMISSION_LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'Deutsch', value: 'de' },
] as const;

export type SubmissionLanguage = (typeof SUBMISSION_LANGUAGES)[number]['value'];

/**
 * One ticked box, worded as the person saw it: the label, a fingerprint of
 * that exact wording (`version`, see `wordingVersion`) and when it was ticked
 * – the moment the form was sent. Entries recorded before October 2026 carry
 * only `field` and `label`.
 */
export type AgreedTo = { field: string; label: string; version?: string; at?: string }[];

/**
 * The version of a box's wording: the first twelve hex digits of its SHA-256.
 * Any edit to the label – a word, a link, the other language – gives a new
 * version, and the same wording always the same one, so nobody has to keep a
 * version number by hand and a consent can be matched to its exact text.
 */
export const wordingVersion = (label: string): string =>
  createHash('sha256').update(label.normalize('NFC'), 'utf8').digest('hex').slice(0, 12);

/** Fields that only the hook below writes, on create. */
const recordOnly = { update: () => false };

/** Option keys picked per multi-select question, e.g. `{ events: ['tue-lio'] }`. */
export type ChoiceKeys = Record<string, string[]>;

export const submissionRecordFields: Field[] = [
  {
    name: 'language',
    access: recordOnly,
    type: 'select',
    label: 'Language',
    options: [...SUBMISSION_LANGUAGES],
    admin: {
      position: 'sidebar',
      readOnly: true,
      description: 'The language the form was sent in. Write back in it.',
    },
  },
  {
    name: 'agreedTo',
    access: recordOnly,
    type: 'json',
    label: 'Agreed to',
    admin: {
      readOnly: true,
      description:
        'Every box the person ticked, worded exactly as they saw it, with the version of that wording and the time it was sent – the proof of their consent. Kept as sent: the form’s own labels may be edited later, and nobody can change this record.',
    },
  },
  {
    name: 'choiceKeys',
    access: recordOnly,
    type: 'json',
    label: 'Picked options',
    admin: {
      readOnly: true,
      description:
        'The stable keys of the options picked in multi-select questions (e.g. the TechTour evenings, "tue-lio"). The answers above keep the labels as shown, which change when an option is renamed; these do not.',
    },
  },
];

type FormBlock = {
  blockType: string;
  name?: string;
  label?: string | null;
  options?: OptionRow[] | null;
};

/**
 * `beforeChange` on form-submissions: fills `language`, `agreedTo` and
 * `choiceKeys` on create. The site posts with `?locale=`, so `req.locale` is
 * the language the visitor used, and the form is read in that language – with
 * the same fallback the page had – so the labels match what was on screen.
 */
export const recordSubmission: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data;
  const language: SubmissionLanguage = req.locale === 'de' ? 'de' : 'en';

  const formId = typeof data?.form === 'object' && data.form ? data.form.id : data?.form;
  const form =
    formId == null
      ? null
      : await req.payload
          .findByID({ collection: 'forms', id: formId, depth: 0, locale: language, req })
          .catch(() => null);
  // Never keep values the client sent for these: they are ours to write.
  if (!form) return { ...data, language, agreedTo: null, choiceKeys: null };

  const answers = new Map<string, string>(
    ((data?.submissionData ?? []) as { field: string; value: unknown }[]).map((kv) => [
      kv.field,
      String(kv.value ?? ''),
    ]),
  );
  const at = new Date().toISOString();
  const agreedTo: AgreedTo = [];
  const choiceKeys: ChoiceKeys = {};
  for (const block of (form.fields ?? []) as FormBlock[]) {
    const answer = block.name ? answers.get(block.name) : undefined;
    if (!block.name || answer === undefined) continue;
    if (block.blockType === 'checkbox' && answer === 'true') {
      const label = block.label || block.name;
      agreedTo.push({ field: block.name, label, version: wordingVersion(label), at });
    } else if (block.blockType === 'checkboxGroup' && answer) {
      choiceKeys[block.name] = pickedKeys(answer, block.options ?? []);
    }
  }
  return { ...data, language, agreedTo, choiceKeys };
};
