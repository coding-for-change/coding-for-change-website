import type { BeforeEmail, FormattedEmail } from '@payloadcms/plugin-form-builder/types';
import { buildApplicationEmail } from './applicationEmailTemplate';

/** The membership application is the form titled "application" (as on /join/apply). */
const APPLICATION_FORM_TITLE = 'application';

const SITE_ORIGIN = () =>
  (process.env.PUBLIC_SITE_ORIGIN || 'https://codingforchange.com').replace(/\/+$/, '');

/**
 * `beforeEmail` for the form-builder plugin: the mail that goes back to the
 * applicant ("to" is their own address, i.e. the form's `{{email}}` entry) is
 * replaced by the branded confirmation from applicationEmailTemplate.ts, in
 * the language the form was sent in (the site posts with `?locale=`).
 *
 * Everything else passes through untouched: other forms, and any mail of this
 * form addressed to someone else (e.g. a notification to the team). Whether
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
  if (form?.title?.trim().toLowerCase() !== APPLICATION_FORM_TITLE) return emails;

  const answers = new Map<string, string>(
    ((data?.submissionData ?? []) as { field: string; value: unknown }[]).map((kv) => [
      kv.field,
      String(kv.value ?? ''),
    ]),
  );
  const applicant = (answers.get('email') ?? '').trim().toLowerCase();
  if (!applicant) return emails;

  const built = buildApplicationEmail({
    firstName: answers.get('firstName'),
    lang: req.locale === 'de' ? 'de' : 'en',
    siteOrigin: SITE_ORIGIN(),
    contactEmail: process.env.CONTACT_TO_EMAIL || 'info@codingforchange.com',
  });

  return emails.map((email) =>
    email.to.trim().toLowerCase() === applicant
      ? ({ ...email, subject: built.subject, html: built.html, text: built.text } as FormattedEmail)
      : email,
  );
};
