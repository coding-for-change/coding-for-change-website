import type { CollectionBeforeChangeHook, Field } from 'payload';

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
 * language; nothing writes them afterwards.
 */

export const SUBMISSION_LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'Deutsch', value: 'de' },
] as const;

export type SubmissionLanguage = (typeof SUBMISSION_LANGUAGES)[number]['value'];

/** One ticked box, worded as the person saw it. */
export type AgreedTo = { field: string; label: string }[];

/** Option keys picked per multi-select question, e.g. `{ events: ['tue-lio'] }`. */
export type ChoiceKeys = Record<string, string[]>;

export const submissionRecordFields: Field[] = [
  {
    name: 'language',
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
    type: 'json',
    label: 'Agreed to',
    admin: {
      readOnly: true,
      description:
        'Every box the person ticked, worded exactly as they saw it when they sent the form. Kept as proof: the form’s own labels may be edited later.',
    },
  },
  {
    name: 'choiceKeys',
    type: 'json',
    label: 'Picked options',
    admin: {
      readOnly: true,
      description:
        'The stable keys of the options picked in multi-select questions (e.g. the TechTour evenings, "tue-lio"). The answers above keep the labels as shown, which change when an option is renamed; these do not.',
    },
  },
];

type OptionRow = { label?: string | null; value: string };

/**
 * The option keys behind a stored multi-select answer. The site sends the
 * picked labels joined by ", " in option order (CmsForm's `serialise`), so
 * they are read back in that order. Should that not add up – a label edited
 * while the visitor had the page open – each label is looked for anywhere in
 * the answer instead.
 */
export function pickedKeys(answer: string, options: OptionRow[]): string[] {
  const keys: string[] = [];
  let rest = answer.trim();
  for (const o of options) {
    const label = o.label?.trim();
    if (!label || !rest) continue;
    if (rest === label) {
      keys.push(o.value);
      rest = '';
    } else if (rest.startsWith(`${label}, `)) {
      keys.push(o.value);
      rest = rest.slice(label.length + 2);
    }
  }
  if (!rest) return keys;
  return options.filter((o) => o.label?.trim() && answer.includes(o.label.trim())).map((o) => o.value);
}

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
  const agreedTo: AgreedTo = [];
  const choiceKeys: ChoiceKeys = {};
  for (const block of (form.fields ?? []) as FormBlock[]) {
    const answer = block.name ? answers.get(block.name) : undefined;
    if (!block.name || answer === undefined) continue;
    if (block.blockType === 'checkbox' && answer === 'true') {
      agreedTo.push({ field: block.name, label: block.label || block.name });
    } else if (block.blockType === 'checkboxGroup' && answer) {
      choiceKeys[block.name] = pickedKeys(answer, block.options ?? []);
    }
  }
  return { ...data, language, agreedTo, choiceKeys };
};
