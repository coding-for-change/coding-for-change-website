import type { BeforeEmail, FormattedEmail } from '@payloadcms/plugin-form-builder/types';
import type { ChoiceKeys } from '../fields/submissionRecord';
import { buildApplicationEmail } from './applicationEmailTemplate';
import { eveningOf } from './share/evening';
import { buildTechTourEmail, type TechTourEmailEvening } from './techtourEmailTemplate';

/** The membership application is the form titled "application" (as on /join/apply). */
const APPLICATION_FORM_TITLE = 'application';
/** The TechTour registration is the form titled "techtour" (as on /techtour/apply). */
const TECHTOUR_FORM_TITLE = 'techtour';

const SITE_ORIGIN = () =>
  (process.env.PUBLIC_SITE_ORIGIN || 'https://codingforchange.com').replace(/\/+$/, '');

/**
 * `beforeEmail` for the form-builder plugin: the mail that goes back to the
 * applicant ("to" is their own address, i.e. the form's `{{email}}` entry) is
 * replaced by a branded confirmation, in the language the form was sent in
 * (the site posts with `?locale=`) – applicationEmailTemplate.ts for the
 * membership application, techtourEmailTemplate.ts (with the evenings they
 * picked) for the TechTour. Both tell the person to just reply, so a reply
 * goes to the team when the admin's entry names no reply-to address.
 *
 * Everything else passes through untouched: other forms, and any mail of these
 * forms addressed to someone else (e.g. a notification to the team). Whether
 * the confirmation goes out at all is still decided in the admin – delete the
 * form's email entry and nothing is sent.
 */
export const brandApplicationEmails: BeforeEmail = async (emails, { data, req }) => {
  if (!emails.length) return emails;
  const formId = typeof data?.form === 'object' ? data.form?.id : data?.form;
  if (formId == null) return emails;

  const form = await req.payload
    .findByID({ collection: 'forms', id: formId, depth: 0, req })
    .catch(() => null);
  const kind = form?.title?.trim().toLowerCase();
  if (kind !== APPLICATION_FORM_TITLE && kind !== TECHTOUR_FORM_TITLE) return emails;

  const answers = new Map<string, string>(
    ((data?.submissionData ?? []) as { field: string; value: unknown }[]).map((kv) => [
      kv.field,
      String(kv.value ?? ''),
    ]),
  );
  const applicant = (answers.get('email') ?? '').trim().toLowerCase();
  if (!applicant) return emails;

  const lang = req.locale === 'de' ? 'de' : 'en';
  const contactEmail = process.env.CONTACT_TO_EMAIL || 'info@codingforchange.com';
  const common = { firstName: answers.get('firstName'), lang, siteOrigin: SITE_ORIGIN(), contactEmail } as const;
  const built =
    kind === TECHTOUR_FORM_TITLE
      ? buildTechTourEmail({ ...common, evenings: await pickedEvenings(req, formId, data?.choiceKeys, lang) })
      : buildApplicationEmail(common);

  return emails.map((email) =>
    email.to.trim().toLowerCase() === applicant
      ? ({
          ...email,
          subject: built.subject,
          html: built.html,
          text: built.text,
          replyTo: email.replyTo?.trim() || contactEmail,
        } as FormattedEmail)
      : email,
  );
};

/**
 * The evenings a TechTour registration picked, in date order: the option keys
 * the submission recorded on arrival (`choiceKeys`, fields/submissionRecord.ts
 * – its beforeChange hook has run by now), matched to the TechTour page the
 * way the host share links match them. Keys of any other multi-select find no
 * evening and drop out.
 */
async function pickedEvenings(
  req: Parameters<BeforeEmail>[1]['req'],
  formId: number | string,
  choiceKeys: ChoiceKeys | null | undefined,
  lang: 'en' | 'de',
): Promise<TechTourEmailEvening[]> {
  const evenings: TechTourEmailEvening[] = [];
  // One after the other: a local-API read with `locale` writes it onto `req`,
  // and eveningOf reads the form in English and the page in `lang`.
  for (const key of Object.values(choiceKeys ?? {}).flat()) {
    const evening = await eveningOf(req.payload, formId, key, req, lang).catch(() => null);
    if (evening) evenings.push(evening);
  }
  return evenings.sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity));
}
