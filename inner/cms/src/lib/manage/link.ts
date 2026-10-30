/**
 * The personal TechTour link as the mass mail (endpoints/waitlistEmail.ts)
 * puts it into a message. No server imports: the compose form in the admin
 * (components/waitlist/SendWaitlistEmail.tsx) shares the placeholder.
 */

/** Typed into the message or the button link; replaced per recipient with their own link. */
export const MANAGE_LINK_PLACEHOLDER = '{{manageLink}}';

/** Stands in for the token in test mails and the preview: it opens no registration. */
export const SAMPLE_TOKEN = 'sample';

export const manageUrl = (siteOrigin: string, token: string): string =>
  `${siteOrigin}/techtour/manage?token=${encodeURIComponent(token)}`;

export const withManageLink = (text: string, url: string): string =>
  text.split(MANAGE_LINK_PLACEHOLDER).join(url);
