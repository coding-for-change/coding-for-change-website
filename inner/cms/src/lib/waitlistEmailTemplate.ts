/**
 * Branded HTML template for the "email all waitlist signups" feature
 * (endpoints/waitlistEmail.ts). One function turns the admin's plain-text
 * message (+ optional header image and CTA button) into the html/text pair
 * handed to Resend.
 *
 * Email clients are not browsers: Gmail strips <style> in the body of some
 * clients, Outlook (Windows) renders with Word. So the layout is table-based
 * with every style inlined, images carry explicit width/height attributes,
 * and the only <style> block is a small-screen padding override (ignored
 * where unsupported — the inline styles remain a correct fallback). The card
 * uses the fluid-hybrid width pattern: CSS `width:100%;max-width:600px`
 * (`width:600px;max-width:100%` does NOT shrink — percentage max-widths
 * can't resolve inside auto-layout table cells) plus a fixed 600px ghost
 * table in `[if mso]` conditionals for Outlook, which ignores max-width.
 *
 * Design: monochrome ink-on-white, echoing the >_♡ terminal logo — the header
 * is the horizontal brand lockup as a 2x PNG (inner/public/images/
 * email-logo-wordmark.png, rasterized from the brand SVG), monospace for the
 * button/site link (webfonts don't load in mail clients, so the mono stack
 * leans on system fonts: Menlo on Apple, Consolas on Windows), a plain sans
 * stack for the body. No accent color: the header image is shown as a
 * contained card on a light band and provides the color, the frame stays
 * quiet.
 *
 * Kept dependency-free on purpose: it can be rendered standalone
 * (`node --experimental-strip-types`) to preview the design without booting
 * the CMS.
 */

export type WaitlistEmailContent = {
  /** Plain text; blank lines separate paragraphs, bare URLs become links. */
  message: string;
  /** Unsubscribe/contact address shown in the footer. */
  contactEmail: string;
  /** Absolute https origin serving the logo + site link (no trailing slash). */
  siteOrigin: string;
  /** <html lang>: 'de' for German-only sends, 'en' otherwise. */
  lang?: 'en' | 'de';
  /** Optional image shown full-width between header and body (absolute URL). */
  headerImageUrl?: string;
  /**
   * Dominant hue/sat of the header image (see lib/heroAccent.ts) — tints the
   * band behind the image card. Lightness is owned here so the band stays in
   * its soft pastel range; omitted/null → neutral stone band.
   */
  heroAccent?: { hue: number; sat: number } | null;
  /** Optional button under the message; both label and URL or neither. */
  ctaLabel?: string;
  ctaUrl?: string;
};

export type BuiltWaitlistEmail = {
  html: string;
  text: string;
  /** Inbox snippet (first line of the message), also hidden in the html. */
  preheader: string;
};

// Pure neutral grays — deliberately no tint, so the frame never fights the
// artwork in the header image. Shared with applicationEmailTemplate.ts.
export const INK = '#171717';
export const MUTED = '#6f6f6f';
export const LINE = '#e8e8e8';
export const PAGE_BG = '#f4f4f4';

export const FONT_BODY = "'IBM Plex Sans','Helvetica Neue',Helvetica,Arial,sans-serif";
export const FONT_MONO = "'IBM Plex Mono','SF Mono',Menlo,Consolas,'Courier New',monospace";

/** h in [0,360), s and l in [0,1] → #rrggbb (emails need literal hex). */
const hslToHex = (h: number, s: number, l: number): string => {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
};

// Band behind the header-image card: three gradient stops + a flat fallback
// (the middle stop) for clients without gradient support. With an accent
// from the artwork the band is a soft pastel of that hue — saturation is
// clamped and lightness fixed, so even loud artwork gets a gentle band —
// otherwise a warm neutral stone.
const bandStops = (accent?: { hue: number; sat: number } | null) => {
  if (!accent) {
    return { top: '#f1efec', mid: '#e7e3de', deep: '#d8d3cc' };
  }
  const hue = ((accent.hue % 360) + 360) % 360;
  const sat = Math.min(0.58, Math.max(0.3, accent.sat));
  return {
    top: hslToHex(hue, sat * 0.75, 0.9),
    mid: hslToHex(hue, sat, 0.8),
    deep: hslToHex(hue, sat, 0.68),
  };
};

export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Turn bare http(s) URLs in already-escaped text into links (quotes are
// escaped, so the URL can't break out of the href attribute). The final
// character class keeps trailing sentence punctuation out of the link.
const linkify = (escaped: string): string =>
  escaped.replace(
    /(https?:\/\/[^\s<]*[^\s<.,;:!?)"'])/g,
    `<a href="$1" style="color:${INK};text-decoration:underline;">$1</a>`,
  );

const paragraphsHtml = (message: string): string =>
  message
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 1.2em;">${linkify(escapeHtml(p)).replace(/\n/g, '<br />')}</p>`,
    )
    .join('');

/** Start of the message collapsed to one line — the inbox preview snippet. */
const preheaderFrom = (message: string): string =>
  message.replace(/\s+/g, ' ').trim().slice(0, 140);

const footerParagraphs = (contactEmail: string) => {
  const mail = escapeHtml(contactEmail);
  const link = `<a href="mailto:${mail}" style="color:${MUTED};text-decoration:underline;">${mail}</a>`;
  return {
    de: `Du erhältst diese E-Mail, weil du dich auf codingforchange.com in die Warteliste eingetragen hast. Zum Abmelden genügt eine kurze Nachricht an ${link}.`,
    en: `You are receiving this email because you joined the waitlist on codingforchange.com. To unsubscribe, just send a short message to ${link}.`,
  };
};

export function buildWaitlistEmail(input: WaitlistEmailContent): BuiltWaitlistEmail {
  const {
    message,
    contactEmail,
    siteOrigin,
    lang = 'en',
    headerImageUrl,
    heroAccent,
    ctaLabel,
    ctaUrl,
  } = input;

  const preheader = preheaderFrom(message);
  // Horizontal ">_♡ Coding for Change" lockup (rasterized from the brand SVG
  // at 2x — mail clients don't render SVG). Served by the inner app.
  const logoUrl = `${siteOrigin}/images/email-logo-wordmark.png`;

  // ---- text/plain part (kept close to what the admin typed) ----
  const textParts = [message.trim()];
  if (ctaLabel && ctaUrl) textParts.push(`${ctaLabel}: ${ctaUrl}`);
  textParts.push(
    [
      '—',
      `Du erhältst diese E-Mail, weil du dich auf codingforchange.com in die Warteliste eingetragen hast. Zum Abmelden genügt eine kurze Nachricht an ${contactEmail}.`,
      `You are receiving this email because you joined the waitlist on codingforchange.com. To unsubscribe, just send a short message to ${contactEmail}.`,
    ].join('\n\n'),
  );
  const text = textParts.join('\n\n');

  // ---- html part ----
  const hasCta = Boolean(ctaLabel && ctaUrl);

  // The image is shown as a contained card on a soft tinted band (not
  // full-bleed): event artwork tends to be big and square, and at full width
  // it dominates the mail. ~360px keeps it a skimmable banner, like a chat
  // link preview — and like those previews, the band picks up the artwork's
  // dominant color (bandStops above; neutral stone when no accent was
  // extractable). Gradient and shadow are progressive enhancement: clients
  // that drop them (Outlook, partly Gmail) keep the flat mid tone from
  // bgcolor/background-color and the tonal contrast still defines the card.
  const band = bandStops(heroAccent);
  const heroRow = headerImageUrl
    ? `<tr>
        <td class="wl-pad" align="center" bgcolor="${band.mid}" style="background-color:${band.mid};background:linear-gradient(150deg,${band.top} 0%,${band.mid} 45%,${band.deep} 100%);padding:34px 40px;">
          <img src="${escapeHtml(headerImageUrl)}" width="360" alt=""
            style="display:inline-block;border:0;border-radius:12px;width:100%;max-width:360px;height:auto;background-color:#ffffff;box-shadow:0 14px 34px rgba(23,23,23,0.14),0 3px 8px rgba(23,23,23,0.08);" />
        </td>
      </tr>`
    : '';

  // Solid-color td + padded link = the classic button that survives Outlook.
  const ctaRow = hasCta
    ? `<tr>
        <td class="wl-pad" align="center" style="padding:10px 40px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" bgcolor="${INK}" style="background-color:${INK};">
                <a href="${escapeHtml(ctaUrl as string)}"
                  style="display:inline-block;padding:14px 36px;font-family:${FONT_MONO};font-size:15px;font-weight:600;letter-spacing:0.5px;color:#ffffff;text-decoration:none;">${escapeHtml(ctaLabel as string)}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : '';

  const footer = footerParagraphs(contactEmail);

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title></title>
<style>
  @media only screen and (max-width: 620px) {
    .wl-pad { padding-left: 24px !important; padding-right: 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}${'&nbsp;&zwnj;'.repeat(48)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};">
  <tr>
    <td align="center" style="padding:36px 12px;">
      <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr>
          <td style="background-color:#ffffff;border:1px solid ${LINE};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="wl-pad" align="center" style="padding:36px 40px 28px;">
                  <img src="${escapeHtml(logoUrl)}" width="300" height="41" alt="&gt;_&#9825; Coding for Change"
                    style="display:inline-block;border:0;max-width:100%;height:auto;" />
                </td>
              </tr>
              ${heroRow}
              <tr>
                <td class="wl-pad" style="padding:34px 40px ${hasCta ? '6px' : '36px'};font-family:${FONT_BODY};font-size:16px;line-height:1.7;color:${INK};">
                  ${paragraphsHtml(message)}
                </td>
              </tr>
              ${ctaRow}
              <tr>
                <td class="wl-pad" style="padding:22px 40px 26px;border-top:1px solid ${LINE};font-family:${FONT_BODY};font-size:12px;line-height:1.65;color:${MUTED};">
                  <p style="margin:0 0 8px;">${footer.de}</p>
                  <p style="margin:0;">${footer.en}</p>
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

  return { html, text, preheader };
}
