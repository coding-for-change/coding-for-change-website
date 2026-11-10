/**
 * The password sheets in the onboarding download: one printed page per new
 * member with their name, association address, first password and the
 * onboarding page, for the board to hand over in person. German first, then
 * English, like the rest of what members read.
 *
 * A self-contained HTML file (no scripts, no outside resources), printed from
 * the browser: each sheet ends in a page break. Everything that comes from
 * people is escaped.
 */

export type SheetPerson = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const STYLE = `
@page { size: A4; margin: 22mm 20mm; }
* { box-sizing: border-box; }
body { margin: 0; font: 11pt/1.5 system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #111; }
.sheet { break-after: page; page-break-after: always; padding: 0 0 8mm; }
.sheet:last-child { break-after: auto; page-break-after: auto; }
.brand { font-size: 10pt; letter-spacing: .08em; text-transform: uppercase; color: #555; margin: 0 0 6mm; }
h1 { font-size: 20pt; margin: 0 0 1mm; }
.sub { margin: 0 0 8mm; color: #444; }
dl { display: grid; grid-template-columns: 42mm 1fr; gap: 3mm 4mm; margin: 0 0 9mm; padding: 6mm; border: 1px solid #999; border-radius: 3mm; }
dt { color: #444; }
dd { margin: 0; font-weight: 600; word-break: break-all; }
.secret { font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-size: 17pt; letter-spacing: .12em; }
h2 { font-size: 12pt; margin: 6mm 0 2mm; }
ol { margin: 0; padding-left: 6mm; }
li { margin: 0 0 1.5mm; }
.note { margin-top: 8mm; font-size: 9.5pt; color: #444; }
@media screen { body { background: #eee; } .sheet { background: #fff; max-width: 190mm; margin: 10mm auto; padding: 16mm; box-shadow: 0 1px 4px rgba(0,0,0,.2); } }
`;

function sheet(p: SheetPerson, onboardingUrl: string): string {
  const name = escapeHtml(`${p.firstName} ${p.lastName}`.trim());
  const email = escapeHtml(p.email);
  const password = escapeHtml(p.password);
  const url = escapeHtml(onboardingUrl);
  return `<section class="sheet">
<p class="brand">Coding for Change e.V.</p>
<h1>${name}</h1>
<p class="sub">Dein Vereinskonto / Your association account</p>
<dl>
<dt>Adresse / Address</dt><dd>${email}</dd>
<dt>Erstes Passwort / First password</dt><dd class="secret">${password}</dd>
<dt>Onboarding</dt><dd>${url}</dd>
</dl>
<h2>So geht es los</h2>
<ol>
<li>Melde dich auf accounts.google.com mit deiner Adresse und diesem Passwort an.</li>
<li>Google bittet dich dann, ein eigenes Passwort zu wählen.</li>
<li>Öffne ${url} und melde dich mit Google an. Dort findest du das Formular, deine To-dos und die Dokumente.</li>
</ol>
<h2 lang="en">Getting started</h2>
<ol lang="en">
<li>Sign in at accounts.google.com with your address and this password.</li>
<li>Google then asks you to choose a password of your own.</li>
<li>Open ${url} and sign in with Google. You will find the form, your to-dos and the documents there.</li>
</ol>
<p class="note">Dieses Passwort gilt nur für die erste Anmeldung. Bitte bewahre den Zettel nicht auf, sobald du ein eigenes Passwort hast. / This password is for your first sign-in only. Please do not keep this sheet once you have chosen your own password.</p>
</section>`;
}

export function buildSheetsHtml(people: SheetPerson[], onboardingUrl: string): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Coding for Change: Zugangsdaten / Sign-in sheets</title>
<style>${STYLE}</style>
</head>
<body>
${people.map((p) => sheet(p, onboardingUrl)).join('\n')}
</body>
</html>
`;
}
