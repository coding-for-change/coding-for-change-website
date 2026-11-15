import { GOOGLE_CSV_HEADER } from './googleCsv';

/**
 * Sending the sign-in details by mail instead of on paper: the board uploads
 * the Google CSV of an earlier download in /admin/onboarding (the only place
 * the first passwords exist) and every person in it gets a mail at their
 * private address with their association address, first password and the
 * way to the onboarding page, plus their password sheet as an attachment.
 *
 * This file is the pure part: reading that CSV back and filling the mail's
 * template. The template (subject and message) is in Onboarding Settings and
 * can be changed for one send in the dashboard. Passwords are only ever in
 * the request: nothing here stores or logs them.
 */

export type AccountMailRow = { firstName: string; lastName: string; email: string; password: string };

export const ACCOUNT_MAIL_MAX_BYTES = 512 * 1024;
export const ACCOUNT_MAIL_MAX_ROWS = 200;

/** What a template may use, as `{{name}}`. */
export const ACCOUNT_MAIL_PLACEHOLDERS = ['firstName', 'lastName', 'email', 'password', 'onboardingUrl'] as const;
type Placeholder = (typeof ACCOUNT_MAIL_PLACEHOLDERS)[number];

export const DEFAULT_ACCOUNT_MAIL_SUBJECT = 'Dein Coding for Change Konto / Your Coding for Change account';

export const DEFAULT_ACCOUNT_MAIL_MESSAGE = `Hallo {{firstName}},

willkommen bei Coding for Change! Hier sind die Zugangsdaten für dein Vereinskonto:

Adresse: {{email}}
Erstes Passwort: {{password}}

So geht es los:
1. Melde dich auf https://accounts.google.com mit dieser Adresse und dem Passwort an. Google bittet dich dann, ein eigenes Passwort zu wählen.
2. Öffne {{onboardingUrl}} und melde dich mit Google an. Dort findest du das Formular, deine To-dos und die Dokumente.

Das Passwort gilt nur für die erste Anmeldung. Die Zugangsdaten hängen zusätzlich als Datei an. Bitte lösche diese Mail, sobald du dein eigenes Passwort gewählt hast.

English version:

Hi {{firstName}},

welcome to Coding for Change! Here are the sign-in details of your association account:

Address: {{email}}
First password: {{password}}

Getting started:
1. Sign in at https://accounts.google.com with this address and the password. Google then asks you to choose a password of your own.
2. Open {{onboardingUrl}} and sign in with Google. You will find the form, your to-dos and the documents there.

The password is for your first sign-in only. The details are also attached as a file. Please delete this mail once you have chosen your own password.`;

/** RFC 4180: quoted cells, doubled quotes, CRLF or LF, an optional byte-order mark. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

const COLUMNS = {
  firstName: GOOGLE_CSV_HEADER[0],
  lastName: GOOGLE_CSV_HEADER[1],
  email: GOOGLE_CSV_HEADER[2],
  password: GOOGLE_CSV_HEADER[3],
} as const;

/**
 * The people in a Google users CSV as the dashboard downloads it. Columns are
 * found by their header names, so a file re-saved by a spreadsheet program
 * with the columns in another order still reads. `error` when it is not such
 * a file; `problems` name single rows that were left out (1 = first person).
 */
export function readAccountCsv(text: string): { rows: AccountMailRow[]; problems: string[]; error: string | null } {
  const none = (error: string) => ({ rows: [], problems: [], error });
  if (text.length > ACCOUNT_MAIL_MAX_BYTES) return none('The file is too large for a Google users CSV.');
  const table = parseCsv(text);
  if (table.length === 0) return none('The file is empty.');
  const header = table[0].map((h) => h.trim());
  const index = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, name]) => [key, header.indexOf(name)]),
  ) as Record<keyof typeof COLUMNS, number>;
  const missing = Object.entries(COLUMNS)
    .filter(([key]) => index[key as keyof typeof COLUMNS] < 0)
    .map(([, name]) => `"${name}"`);
  if (missing.length) {
    return none(`This is not the google-users.csv from the onboarding download: the column ${missing.join(', ')} is missing.`);
  }
  if (table.length - 1 > ACCOUNT_MAIL_MAX_ROWS) return none(`At most ${ACCOUNT_MAIL_MAX_ROWS} people in one file.`);

  const rows: AccountMailRow[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((cells, i) => {
    const at = (k: keyof typeof COLUMNS) => (cells[index[k]] ?? '').trim();
    const email = at('email').toLowerCase();
    const password = at('password');
    if (!email || !password) {
      problems.push(`Row ${i + 1}: ${email || 'no address'} has ${email ? 'no password' : 'no address'}, left out.`);
      return;
    }
    if (seen.has(email)) {
      problems.push(`Row ${i + 1}: ${email} is in the file twice, only the first row is used.`);
      return;
    }
    seen.add(email);
    rows.push({ firstName: at('firstName'), lastName: at('lastName'), email, password });
  });
  return { rows, problems, error: null };
}

const USED = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

/** Why a template cannot be sent, or null. */
export function templateProblem(subject: string, message: string): string | null {
  if (!subject.trim()) return 'The subject is empty.';
  if (subject.length > 200) return 'The subject is longer than 200 characters.';
  if (/[\r\n]/.test(subject)) return 'The subject must be one line.';
  if (!message.trim()) return 'The message is empty.';
  if (message.length > 10000) return 'The message is longer than 10,000 characters.';
  const known = new Set<string>(ACCOUNT_MAIL_PLACEHOLDERS);
  const unknown = [...`${subject}\n${message}`.matchAll(USED)].map((m) => m[1]).filter((name) => !known.has(name));
  if (unknown.length) {
    return `Unknown placeholder {{${unknown[0]}}}. Available: ${ACCOUNT_MAIL_PLACEHOLDERS.map((p) => `{{${p}}}`).join(', ')}.`;
  }
  const inMessage = new Set([...message.matchAll(USED)].map((m) => m[1]));
  if (!inMessage.has('password')) return 'The message must contain {{password}}: that is what this mail is for.';
  if (!inMessage.has('email')) return 'The message must contain {{email}}, the address they sign in with.';
  if ([...subject.matchAll(USED)].some((m) => m[1] === 'password')) return 'The password must not be in the subject.';
  return null;
}

/** The text with every `{{placeholder}}` filled in. Values are put in as they are: escaping is the mail frame's job. */
export function fillTemplate(text: string, values: Record<Placeholder, string>): string {
  return text.replace(USED, (whole, name: string) => (name in values ? values[name as Placeholder] : whole));
}
