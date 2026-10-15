import { FONT_BODY, FONT_MONO, INK, LINE, MUTED, PAGE_BG, escapeHtml as esc } from '../waitlistEmailTemplate';

/**
 * The six-digit code a host company's contact gets when signing in to a
 * share link. Same frame as the other mails (lib/waitlistEmailTemplate.ts),
 * cut down to what the moment needs: the code, big, and what it is for.
 * English, like the page it signs in to.
 */
export function buildShareCodeEmail(input: {
  code: string;
  title: string;
  siteOrigin: string;
  contactEmail: string;
}): { subject: string; html: string; text: string } {
  const { code, title, siteOrigin, contactEmail } = input;
  const subject = `${code} is your code for the TechTour registrations`;
  const text = [
    `Your code: ${code}`,
    `It signs you in to the registrations for "${title}" and works for 10 minutes.`,
    'If you did not ask for it, you can ignore this email – nobody gets in without the code.',
    '–',
    `Coding for Change e.V. · ${contactEmail}`,
  ].join('\n\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};">
  <tr>
    <td align="center" style="padding:36px 12px;">
      <!--[if mso]><table role="presentation" width="520" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;">
        <tr>
          <td style="background-color:#ffffff;border:1px solid ${LINE};padding:32px 36px;font-family:${FONT_BODY};color:${INK};">
            <img src="${esc(siteOrigin)}/images/email-logo-wordmark.png" width="220" height="30" alt="&gt;_&#9825; Coding for Change"
              style="display:block;border:0;max-width:100%;height:auto;margin:0 0 28px;" />
            <p style="margin:0 0 8px;font-family:${FONT_MONO};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};">Your sign-in code</p>
            <p style="margin:0 0 20px;font-family:${FONT_MONO};font-size:36px;font-weight:600;letter-spacing:8px;color:${INK};">${esc(code)}</p>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">It signs you in to the registrations for <strong>${esc(title)}</strong> and works for 10 minutes.</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">If you did not ask for it, you can ignore this email – nobody gets in without the code.</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:18px 8px 0;font-family:${FONT_BODY};font-size:12px;color:${MUTED};">
            Coding for Change e.V. · <a href="mailto:${esc(contactEmail)}" style="color:${MUTED};">${esc(contactEmail)}</a>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
  return { subject, html, text };
}
