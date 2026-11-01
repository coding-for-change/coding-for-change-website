import { buildWaitlistEmail } from '../waitlistEmailTemplate';
import { mailFor, SOURCES, type MailingGroup, type MailLang, type SourceKey } from './model';

/**
 * One person's mail from a mailing group: their language (or the other one
 * when theirs is not written), `{{firstName}}` and `{{link}}` filled in, in the
 * branded template of lib/waitlistEmailTemplate.ts. The admin preview renders
 * with this too, so what it shows is what is sent – and what is stored as sent
 * (lib/mailing/store.ts).
 */

export type MailSite = { siteOrigin: string; contactEmail: string };

export type RenderedMail = { lang: MailLang; subject: string; html: string; text: string };

const fill = (s: string, values: Record<string, string>) =>
  s.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) => (key in values ? values[key] : whole));

export function renderMail(
  source: SourceKey,
  group: MailingGroup,
  person: { firstName: string; lang: MailLang },
  site: MailSite,
): RenderedMail | null {
  const used = mailFor(group, person.lang);
  if (!used) return null;
  const link = group.ctaUrl.trim();
  const values = { firstName: person.firstName.trim(), link };
  // "Hi {{firstName}}," with no first name reads "Hi ,": close the gap instead.
  const message = fill(used.mail.message, values).replace(/ +,/g, ',').trim();
  const ctaLabel = used.mail.ctaLabel.trim();
  const { html, text } = buildWaitlistEmail({
    message,
    contactEmail: site.contactEmail,
    siteOrigin: site.siteOrigin,
    lang: used.lang,
    audience: SOURCES[source].audience,
    ctaLabel: link && ctaLabel ? ctaLabel : undefined,
    ctaUrl: link && ctaLabel ? link : undefined,
  });
  return { lang: used.lang, subject: fill(used.mail.subject, values).trim(), html, text };
}
