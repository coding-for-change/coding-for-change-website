/**
 * The personal TechTour link as the mailing tool (endpoints/mailing.ts) puts
 * it into a mail. No server imports: the admin's preview
 * (components/mailing/MailingEditor.tsx) uses the sample link too.
 */

/** Typed into the message or the button link; replaced per recipient with their own link. */
export const MANAGE_LINK_PLACEHOLDER = '{{manageLink}}';

/** Stands in for the token in test mails and the preview: it opens no registration. */
export const SAMPLE_TOKEN = 'sample';

export const manageUrl = (siteOrigin: string, token: string): string =>
  `${siteOrigin}/techtour/manage?token=${encodeURIComponent(token)}`;

export const withManageLink = (text: string, url: string): string =>
  text.split(MANAGE_LINK_PLACEHOLDER).join(url);
