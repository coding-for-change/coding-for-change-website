/**
 * The confirmation an applicant gets right after sending the membership
 * application (form "application"). Sent by the form-builder plugin – the
 * form's Emails tab decides *that* it goes out and to whom (`{{email}}`);
 * `beforeEmail` in payload.config.ts swaps the plain rich-text body for this
 * one, in the language the applicant filled the form in.
 *
 * Same frame as the waitlist mails (lib/waitlistEmailTemplate.ts): table
 * layout, inline styles, the >_♡ wordmark, monochrome ink on white. What is
 * added is a short "what happens next" timeline – dated rows, the date in
 * mono like the site's step badges – so the mail reads at a glance.
 *
 * The dates mirror inner/src/lib/applicationPhase.ts (the CMS cannot import
 * from the inner app). Update both when the next round is planned.
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

export type ApplicationEmailInput = {
  firstName?: string | null;
  lang: 'en' | 'de';
  /** Absolute https origin serving the logo + links (no trailing slash). */
  siteOrigin: string;
  contactEmail: string;
};

export type BuiltApplicationEmail = { subject: string; html: string; text: string };

type Step = { when: string; title: string; text: string };

const COPY = {
  en: {
    subject: 'Your application is in',
    preheader: 'Thanks for applying to Coding for Change – here is what happens next.',
    heading: 'Your application is in.',
    hi: (name: string) => (name ? `Hi ${name},` : 'Hi,'),
    intro:
      'thank you for applying to Coding for Change for Winter 2026/27 – we’re glad you want to be part of it.',
    nextLabel: 'What happens next',
    steps: [
      {
        when: 'By 31 Oct',
        title: 'Interview invitation',
        text: 'By the evening of 31 October you will get an email from us to book your interview slot.',
      },
      {
        when: '2–8 Nov',
        title: 'Interview',
        text: 'A conversation and a small hands-on challenge.',
      },
      {
        when: 'Sat 14 Nov',
        title: 'Intro Event',
        text: 'Save the date – keep the evening free.',
      },
    ] as Step[],
    cta: 'See what we build',
    questions: 'Questions in the meantime? Just reply to this email – it reaches our team directly.',
    signoff: 'See you soon,',
    team: 'The Coding for Change team',
    footer: (mail: string) =>
      `You are receiving this email because you applied on codingforchange.com. Questions about your data: ${mail}.`,
  },
  de: {
    subject: 'Deine Bewerbung ist da',
    preheader: 'Danke für deine Bewerbung bei Coding for Change – so geht es weiter.',
    heading: 'Deine Bewerbung ist da.',
    hi: (name: string) => (name ? `Hallo ${name},` : 'Hallo,'),
    intro:
      'danke, dass du dich bei Coding for Change für das Wintersemester 2026/27 bewirbst – schön, dass du dabei sein willst.',
    nextLabel: 'So geht es weiter',
    steps: [
      {
        when: 'Bis 31. Okt.',
        title: 'Einladung zum Interview',
        text: 'Bis zum Abend des 31. Oktober bekommst du eine E-Mail von uns, in der du deinen Interviewtermin buchst.',
      },
      {
        when: '2.–8. Nov.',
        title: 'Interview',
        text: 'Ein Gespräch und eine kleine praktische Challenge.',
      },
      {
        when: 'Sa. 14. Nov.',
        title: 'Intro Event',
        text: 'Halte dir den Abend schon mal frei.',
      },
    ] as Step[],
    cta: 'Sieh dir unsere Projekte an',
    questions: 'Fragen bis dahin? Antworte einfach auf diese E-Mail – sie landet direkt bei unserem Team.',
    signoff: 'Bis bald',
    team: 'Dein Coding for Change Team',
    footer: (mail: string) =>
      `Du erhältst diese E-Mail, weil du dich auf codingforchange.com beworben hast. Fragen zu deinen Daten: ${mail}.`,
  },
} as const;

export function buildApplicationEmail(input: ApplicationEmailInput): BuiltApplicationEmail {
  const { lang, siteOrigin, contactEmail } = input;
  const c = COPY[lang];
  const name = (input.firstName ?? '').trim();
  const logoUrl = `${siteOrigin}/images/email-logo-wordmark.png`;
  const ctaUrl = `${siteOrigin}/projects`;
  const mail = escapeHtml(contactEmail);
  const mailLink = `<a href="mailto:${mail}" style="color:${MUTED};text-decoration:underline;">${mail}</a>`;

  const text = [
    c.hi(name),
    c.intro,
    `${c.nextLabel}:`,
    ...c.steps.map((s) => `– ${s.when}: ${s.title}. ${s.text}`),
    `${c.cta}: ${ctaUrl}`,
    c.questions,
    `${c.signoff}\n${c.team}`,
    '—',
    c.footer(contactEmail),
  ].join('\n\n');

  // One row per step: the date in a fixed mono column, a rule between rows.
  const stepRows = c.steps
    .map(
      (s, i) => `<tr>
        <td valign="top" width="112" style="width:112px;padding:${i === 0 ? '0' : '16px'} 16px 16px 0;${i < c.steps.length - 1 ? `border-bottom:1px solid ${LINE};` : ''}font-family:${FONT_MONO};font-size:12px;font-weight:600;letter-spacing:0.5px;line-height:1.5;color:${INK};white-space:nowrap;">${escapeHtml(s.when)}</td>
        <td valign="top" style="padding:${i === 0 ? '0' : '16px'} 0 16px;${i < c.steps.length - 1 ? `border-bottom:1px solid ${LINE};` : ''}font-family:${FONT_BODY};font-size:15px;line-height:1.55;color:${INK};">
          <strong style="display:block;font-weight:600;margin:0 0 2px;">${escapeHtml(s.title)}</strong>
          <span style="color:${MUTED};">${escapeHtml(s.text)}</span>
        </td>
      </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(c.subject)}</title>
<style>
  @media only screen and (max-width: 620px) {
    .ap-pad { padding-left: 24px !important; padding-right: 24px !important; }
    .ap-h1 { font-size: 26px !important; }
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
                <td class="ap-pad" align="center" style="padding:36px 40px 28px;border-bottom:1px solid ${LINE};">
                  <img src="${escapeHtml(logoUrl)}" width="300" height="41" alt="&gt;_&#9825; Coding for Change"
                    style="display:inline-block;border:0;max-width:100%;height:auto;" />
                </td>
              </tr>
              <tr>
                <td class="ap-pad" style="padding:36px 40px 8px;font-family:${FONT_BODY};color:${INK};">
                  <p style="margin:0 0 6px;font-family:${FONT_MONO};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};">Winter 2026/27</p>
                  <h1 class="ap-h1" style="margin:0 0 24px;font-family:${FONT_BODY};font-size:30px;line-height:1.2;font-weight:600;color:${INK};">${escapeHtml(c.heading)}</h1>
                  <p style="margin:0 0 1em;font-size:16px;line-height:1.7;">${escapeHtml(c.hi(name))}</p>
                  <p style="margin:0;font-size:16px;line-height:1.7;">${escapeHtml(c.intro)}</p>
                </td>
              </tr>
              <tr>
                <td class="ap-pad" style="padding:28px 40px 8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border:1px solid ${LINE};">
                    <tr>
                      <td style="padding:22px 22px 6px;">
                        <p style="margin:0 0 16px;font-family:${FONT_MONO};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};">${escapeHtml(c.nextLabel)}</p>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                          ${stepRows}
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td class="ap-pad" align="left" style="padding:28px 40px 4px;">
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
                <td class="ap-pad" style="padding:24px 40px 36px;font-family:${FONT_BODY};font-size:16px;line-height:1.7;color:${INK};">
                  <p style="margin:0 0 1.2em;">${escapeHtml(c.questions)}</p>
                  <p style="margin:0;">${escapeHtml(c.signoff)}<br /><strong style="font-weight:600;">${escapeHtml(c.team)}</strong></p>
                </td>
              </tr>
              <tr>
                <td class="ap-pad" style="padding:20px 40px 24px;border-top:1px solid ${LINE};font-family:${FONT_BODY};font-size:12px;line-height:1.65;color:${MUTED};">
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
