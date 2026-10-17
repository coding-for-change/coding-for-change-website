/**
 * The confirmation someone gets right after applying for the TechTour (form
 * "techtour"). Sent by the form-builder plugin – the form's Emails tab decides
 * *that* it goes out and to whom (`{{email}}`); `beforeEmail` in
 * payload.config.ts (lib/applicationEmail.ts) swaps the plain rich-text body
 * for this one, in the language the form was sent in.
 *
 * Same frame as the membership confirmation (applicationEmailTemplate.ts). In
 * place of its timeline, a box with the evenings the person picked – date in
 * mono, the host, the evening's headline, time and place as the TechTour page
 * has them – and below it what happens next, in the words of the form's own
 * confirmation message: the hosts decide, we write with time and place.
 *
 * Dependency-free: render it standalone to preview the design.
 */
import {
  FONT_BODY,
  FONT_MONO,
  INK,
  LINE,
  MUTED,
  PAGE_BG,
  escapeHtml,
} from './waitlistEmailTemplate';

/** One picked evening, as lib/share/evening.ts matches it to the TechTour page. */
export type TechTourEmailEvening = {
  date: Date | null;
  /** null while the host is not fixed yet. */
  company: string | null;
  title: string | null;
  time: string | null;
  location: string | null;
  /** The form option's label – shown when the evening has no date on the page. */
  label: string;
};

export type TechTourEmailInput = {
  firstName?: string | null;
  lang: 'en' | 'de';
  /** Absolute https origin serving the logo + links (no trailing slash). */
  siteOrigin: string;
  contactEmail: string;
  evenings: TechTourEmailEvening[];
};

export type BuiltTechTourEmail = { subject: string; html: string; text: string };

const COPY = {
  en: {
    subject: 'Your Tech Tour application is in',
    preheader: 'Thanks for applying to the Munich Tech Tour – your evenings and what happens next.',
    kicker: 'Munich Tech Tour',
    heading: 'Your application is in.',
    hi: (name: string) => (name ? `Hi ${name},` : 'Hi,'),
    intro: 'thank you for applying to the Munich Tech Tour – we’re glad you want to come along.',
    eveningsLabel: 'Your evenings',
    tbaCompany: 'Company to be announced',
    next: 'The host companies decide who joins their evening. As soon as they have, we’ll email you – with the time and place.',
    cta: 'See the tour',
    questions: 'Questions – or can’t make an evening after all? Just reply to this email – it reaches our team directly.',
    signoff: 'See you soon,',
    team: 'The Coding for Change team',
    footer: (mail: string) =>
      `You are receiving this email because you applied for the Tech Tour on codingforchange.com. Questions about your data: ${mail}.`,
  },
  de: {
    subject: 'Deine Bewerbung für die Tech Tour ist da',
    preheader: 'Danke für deine Bewerbung für die Munich Tech Tour – deine Abende und wie es weitergeht.',
    kicker: 'Munich Tech Tour',
    heading: 'Deine Bewerbung ist da.',
    hi: (name: string) => (name ? `Hallo ${name},` : 'Hallo,'),
    intro: 'danke für deine Bewerbung für die Munich Tech Tour – schön, dass du dabei sein willst.',
    eveningsLabel: 'Deine Abende',
    tbaCompany: 'Unternehmen folgt',
    next: 'Die gastgebenden Unternehmen entscheiden, wer an ihrem Abend dabei ist. Sobald sie das getan haben, schreiben wir dir – mit Uhrzeit und Ort.',
    cta: 'Zur Tour',
    questions: 'Fragen – oder klappt ein Abend doch nicht? Antworte einfach auf diese E-Mail – sie landet direkt bei unserem Team.',
    signoff: 'Bis bald',
    team: 'Dein Coding for Change Team',
    footer: (mail: string) =>
      `Du erhältst diese E-Mail, weil du dich auf codingforchange.com für die Tech Tour beworben hast. Fragen zu deinen Daten: ${mail}.`,
  },
} as const;

const WEEKDAYS = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  de: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
};
const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  de: ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
};

/**
 * "Mon 9 Nov" / "Mo 9. Nov" – the form's own option labels, in Munich time
 * (an evening at 00:30 UTC is still the day before there).
 */
const evenDate = (date: Date, lang: 'en' | 'de'): string => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin',
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  const weekday = WEEKDAYS[lang][WEEKDAYS.en.indexOf(p.weekday)] ?? '';
  // Numeric day and month come out as "09/11" in en-GB.
  const day = Number(p.day);
  const month = MONTHS[lang][Number(p.month) - 1] ?? '';
  return lang === 'de' ? `${weekday} ${day}. ${month}` : `${weekday} ${day} ${month}`;
};

/**
 * What editors type while a time or place is not fixed yet ("TBD", a dash)
 * counts as not known – the mail leaves it out rather than print it. Mirrors
 * `known` in inner/src/lib/techTour.ts (the CMS cannot import from the inner
 * app).
 */
const known = (value?: string | null): string => {
  const v = value?.trim() ?? '';
  return /^(tb[acd]|n\/?a|[-–—?]+)$/i.test(v) ? '' : v;
};

export function buildTechTourEmail(input: TechTourEmailInput): BuiltTechTourEmail {
  const { lang, siteOrigin, contactEmail } = input;
  const c = COPY[lang];
  const name = (input.firstName ?? '').trim();
  const logoUrl = `${siteOrigin}/images/email-logo-wordmark.png`;
  const ctaUrl = `${siteOrigin}/techtour`;
  const mail = escapeHtml(contactEmail);
  const mailLink = `<a href="mailto:${mail}" style="color:${MUTED};text-decoration:underline;">${mail}</a>`;

  const evenings = input.evenings.map((ev) => {
    const host = ev.company ?? (ev.date ? c.tbaCompany : ev.label);
    const title = known(ev.title);
    return {
      when: ev.date ? evenDate(ev.date, lang) : '',
      host,
      title: title && title !== host ? title : '',
      meta: [known(ev.time), known(ev.location)].filter(Boolean).join(' · '),
    };
  });

  const text = [
    c.hi(name),
    c.intro,
    ...(evenings.length
      ? [
          `${c.eveningsLabel}:`,
          evenings
            .map(
              (ev) =>
                `– ${ev.when ? `${ev.when}: ` : ''}${ev.host}${ev.title ? ` – ${ev.title}` : ''}${ev.meta ? ` (${ev.meta})` : ''}`,
            )
            .join('\n'),
        ]
      : []),
    c.next,
    `${c.cta}: ${ctaUrl}`,
    c.questions,
    `${c.signoff}\n${c.team}`,
    '–',
    c.footer(contactEmail),
  ].join('\n\n');

  // One row per evening: the date in a fixed mono column (narrower than the
  // membership mail's – "Tue 10 Nov" is its longest), a rule between rows.
  const pad = (i: number) => (i === 0 ? '0' : '16px');
  const rule = (i: number) => (i < evenings.length - 1 ? `border-bottom:1px solid ${LINE};` : '');
  const eveningRows = evenings
    .map(
      (ev, i) => `<tr>
        <td valign="top" width="100" style="width:100px;padding:${pad(i)} 16px 16px 0;${rule(i)}font-family:${FONT_MONO};font-size:12px;font-weight:600;letter-spacing:0.5px;line-height:1.75;color:${INK};white-space:nowrap;">${escapeHtml(ev.when)}</td>
        <td valign="top" style="padding:${pad(i)} 0 16px;${rule(i)}font-family:${FONT_BODY};font-size:15px;line-height:1.55;color:${INK};">
          <strong style="display:block;font-weight:600;margin:0 0 2px;">${escapeHtml(ev.host)}</strong>
          ${ev.title ? `<span style="display:block;">${escapeHtml(ev.title)}</span>` : ''}
          ${ev.meta ? `<span style="display:block;margin-top:4px;font-family:${FONT_MONO};font-size:12px;color:${MUTED};">${escapeHtml(ev.meta)}</span>` : ''}
        </td>
      </tr>`,
    )
    .join('');

  const eveningsBox = evenings.length
    ? `<tr>
                <td class="tt-pad" style="padding:28px 40px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border:1px solid ${LINE};">
                    <tr>
                      <td style="padding:22px 22px 6px;">
                        <p style="margin:0 0 16px;font-family:${FONT_MONO};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};">${escapeHtml(c.eveningsLabel)}</p>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                          ${eveningRows}
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(c.subject)}</title>
<style>
  @media only screen and (max-width: 620px) {
    .tt-pad { padding-left: 24px !important; padding-right: 24px !important; }
    .tt-h1 { font-size: 26px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(c.preheader)}${'&nbsp;&zwnj;'.repeat(48)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};">
  <tr>
    <td align="center" style="padding:36px 12px;">
      <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr>
          <td style="background-color:#ffffff;border:1px solid ${LINE};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="tt-pad" align="center" style="padding:36px 40px 28px;border-bottom:1px solid ${LINE};">
                  <img src="${escapeHtml(logoUrl)}" width="300" height="41" alt="&gt;_&#9825; Coding for Change"
                    style="display:inline-block;border:0;max-width:100%;height:auto;" />
                </td>
              </tr>
              <tr>
                <td class="tt-pad" style="padding:36px 40px 0;font-family:${FONT_BODY};color:${INK};">
                  <p style="margin:0 0 6px;font-family:${FONT_MONO};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};">${escapeHtml(c.kicker)}</p>
                  <h1 class="tt-h1" style="margin:0 0 24px;font-family:${FONT_BODY};font-size:30px;line-height:1.2;font-weight:600;color:${INK};">${escapeHtml(c.heading)}</h1>
                  <p style="margin:0 0 1em;font-size:16px;line-height:1.7;">${escapeHtml(c.hi(name))}</p>
                  <p style="margin:0;font-size:16px;line-height:1.7;">${escapeHtml(c.intro)}</p>
                </td>
              </tr>
              ${eveningsBox}
              <tr>
                <td class="tt-pad" style="padding:24px 40px 0;font-family:${FONT_BODY};font-size:16px;line-height:1.7;color:${INK};">
                  <p style="margin:0;">${escapeHtml(c.next)}</p>
                </td>
              </tr>
              <tr>
                <td class="tt-pad" align="left" style="padding:28px 40px 4px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" bgcolor="${INK}" style="background-color:${INK};">
                        <a href="${escapeHtml(ctaUrl)}"
                          style="display:inline-block;padding:13px 28px;font-family:${FONT_MONO};font-size:14px;font-weight:600;letter-spacing:0.5px;color:#ffffff;text-decoration:none;">${escapeHtml(c.cta)} →</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td class="tt-pad" style="padding:24px 40px 36px;font-family:${FONT_BODY};font-size:16px;line-height:1.7;color:${INK};">
                  <p style="margin:0 0 1.2em;">${escapeHtml(c.questions)}</p>
                  <p style="margin:0;">${escapeHtml(c.signoff)}<br /><strong style="font-weight:600;">${escapeHtml(c.team)}</strong></p>
                </td>
              </tr>
              <tr>
                <td class="tt-pad" style="padding:20px 40px 24px;border-top:1px solid ${LINE};font-family:${FONT_BODY};font-size:12px;line-height:1.65;color:${MUTED};">
                  ${c.footer(mailLink)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 8px 0;font-family:${FONT_MONO};font-size:11px;letter-spacing:1.5px;color:${MUTED};">
            <a href="${escapeHtml(siteOrigin)}" style="color:${MUTED};text-decoration:none;">codingforchange.com</a>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject: c.subject, html, text };
}
