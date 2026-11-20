/**
 * The CSV for Google Admin Console → Directory → Users → "Bulk update users",
 * which the board uploads by hand after "Create accounts" in /admin/onboarding.
 *
 * The header is the one of the empty template downloaded from that page,
 * column for column (fixtures/google-users-template.csv, which the tests hold
 * it against byte for byte). Google reads the file by these names, so none of
 * them may change. Lines end in CRLF like the template; no byte-order mark.
 *
 * Set per person: first and last name, the association address, the first
 * password (password.ts), the org unit from the onboarding settings, the
 * private address as recovery email, and "Change Password at Next Sign-In" =
 * TRUE. Every other column stays empty, which Google reads as "leave as is"
 * (for an account that exists already: a re-export only sets a new password).
 *
 * Formula injection: the file is also opened in spreadsheet programs, which
 * run a cell that starts with = + - @ (or a tab or carriage return) as a
 * formula. Names and the org unit lose such leading characters (no real name
 * starts with one, and a quote in front, the usual guard, would end up in the
 * Google account's name); the recovery address is dropped when it is not a
 * plain address. Addresses and passwords are ours and cannot start with one.
 */

export const GOOGLE_CSV_HEADER = [
  'First Name [Required]',
  'Last Name [Required]',
  'Email Address [Required]',
  'Password [Required]',
  'Password Hash Function [UPLOAD ONLY]',
  'Org Unit Path [Required]',
  'New Primary Email [UPLOAD ONLY]',
  'Recovery Email',
  'Home Secondary Email',
  'Work Secondary Email',
  'Recovery Phone [MUST BE IN THE E.164 FORMAT]',
  'Work Phone',
  'Home Phone',
  'Mobile Phone',
  'Work Address',
  'Home Address',
  'Employee ID',
  'Employee Type',
  'Employee Title',
  'Manager Email',
  'Department',
  'Cost Center',
  'Building ID',
  'Floor Name',
  'Floor Section',
  'Change Password at Next Sign-In',
  'New Status [UPLOAD ONLY]',
  'New Licenses [UPLOAD ONLY]',
  'Advanced Protection Program enrollment',
] as const;

type Column = (typeof GOOGLE_CSV_HEADER)[number];

export type GoogleUserRow = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  /** The private address from the application; left out when it is not a plain address. */
  recoveryEmail?: string | null;
};

const EOL = '\r\n';

/** Control characters out, whitespace collapsed, and no leading character a spreadsheet would run as a formula. */
export function safeText(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[=+\-@\s]+/, '')
    .trim();
}

/** Starts with a letter or digit, so it cannot start a formula either. */
const PLAIN_ADDRESS = /^[a-z0-9][a-z0-9._%+'-]*@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

/** The address when it is a plain one, else ''. */
export function safeAddress(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  return PLAIN_ADDRESS.test(v) ? v : '';
}

/** The org unit as Google wants it: "/" or "/Members/2026", no formula start, no trailing slash. */
export function safeOrgUnitPath(value: string | null | undefined): string {
  const v = safeText(value ?? '').replace(/^\/*/, '/').replace(/\/+$/, '');
  return v || '/';
}

/** A CSV cell: quoted when it holds a comma, a quote or a line break, quotes doubled. */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildGoogleCsv(rows: GoogleUserRow[], orgUnitPath: string): string {
  const orgUnit = safeOrgUnitPath(orgUnitPath);
  const lines = [GOOGLE_CSV_HEADER.join(',')];
  for (const row of rows) {
    const values: Partial<Record<Column, string>> = {
      'First Name [Required]': safeText(row.firstName),
      'Last Name [Required]': safeText(row.lastName),
      'Email Address [Required]': safeAddress(row.email),
      'Password [Required]': row.password,
      'Org Unit Path [Required]': orgUnit,
      'Recovery Email': safeAddress(row.recoveryEmail),
      'Change Password at Next Sign-In': 'TRUE',
    };
    if (!values['Email Address [Required]']) throw new Error('google csv: a row without a valid address');
    lines.push(GOOGLE_CSV_HEADER.map((column) => csvCell(values[column] ?? '')).join(','));
  }
  return lines.join(EOL) + EOL;
}
