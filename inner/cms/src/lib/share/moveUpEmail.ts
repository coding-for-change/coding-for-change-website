import { buildWaitlistEmail } from '../waitlistEmailTemplate';

/**
 * The mail to someone who just moved up from an evening's waitlist
 * (lib/share/moveUp.ts): the spot is theirs, nothing to confirm, and if they
 * cannot come after all, their own /techtour/manage link to give it up – so
 * the next person moves up in turn. No deadline on purpose: the sooner, the
 * better. In the registration's language, in the frame of the mailing tool's
 * mails (lib/waitlistEmailTemplate.ts).
 */

export type MoveUpEvening = {
  /** The host company, or the form's label for the evening when the TechTour page has none. */
  name: string;
  date: Date | null;
  time: string | null;
  location: string | null;
  title: string | null;
};

const COPY = {
  en: {
    subject: (name: string, day: string) => `You're in: Tech Tour evening at ${name}${day ? ` on ${day}` : ''}`,
    hi: (first: string) => (first ? `Hi ${first},` : 'Hi,'),
    news: (name: string) =>
      `Good news: a spot has opened up at the Tech Tour evening at ${name} – and as you were next on the waitlist, it's yours.`,
    rest:
      "You don't need to confirm anything – we're looking forward to seeing you there. If you can't make it after all, please give up your spot as early as possible with the button below, so the next person on the waitlist can move up.",
    bye: 'See you soon,\nCoding for Change',
    cta: 'Manage your evenings',
  },
  de: {
    subject: (name: string, day: string) => `Du bist dabei: Tech-Tour-Abend bei ${name}${day ? ` am ${day}` : ''}`,
    hi: (first: string) => (first ? `Hi ${first},` : 'Hi,'),
    news: (name: string) =>
      `gute Nachrichten: Beim Tech-Tour-Abend bei ${name} ist ein Platz frei geworden – und weil du auf der Warteliste als Nächste:r dran warst, gehört er jetzt dir.`,
    rest:
      'Du musst nichts bestätigen – wir freuen uns auf dich. Falls du doch nicht kannst, gib deinen Platz bitte so früh wie möglich über den Button unten frei, damit die nächste Person nachrücken kann.',
    bye: 'Bis bald\nCoding for Change',
    cta: 'Deine Abende verwalten',
  },
} as const;

const known = (s: string | null | undefined) => {
  const v = (s ?? '').trim();
  return v && !/^(tbd|tba)$/i.test(v) ? v : '';
};

export function buildMoveUpEmail(input: {
  lang: 'en' | 'de';
  firstName: string;
  evening: MoveUpEvening;
  manageLink: string;
  siteOrigin: string;
  contactEmail: string;
}): { subject: string; html: string; text: string } {
  const { lang, evening } = input;
  const c = COPY[lang];
  const day = evening.date
    ? evening.date.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'Europe/Berlin',
      })
    : '';
  const when = [day, known(evening.time), known(evening.location)].filter(Boolean).join(' · ');
  const about = [known(evening.title), when].filter(Boolean).join('\n');
  const message = [c.hi(input.firstName.trim()) + '\n\n' + c.news(evening.name), about, c.rest, c.bye]
    .filter(Boolean)
    .join('\n\n');
  const { html, text } = buildWaitlistEmail({
    message,
    contactEmail: input.contactEmail,
    siteOrigin: input.siteOrigin,
    lang,
    audience: 'techtour',
    ctaLabel: c.cta,
    ctaUrl: input.manageLink,
  });
  return { subject: c.subject(evening.name, day), html, text };
}
