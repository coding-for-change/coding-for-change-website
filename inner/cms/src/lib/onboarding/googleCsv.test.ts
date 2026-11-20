import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildGoogleCsv, csvCell, GOOGLE_CSV_HEADER, safeAddress, safeOrgUnitPath, safeText } from './googleCsv';

const fixture = readFileSync(fileURLToPath(new URL('./fixtures/google-users-template.csv', import.meta.url)));

/** A minimal CSV reader (RFC 4180) for checking what the builder wrote. */
function parse(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\r' && csv[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else cell += c;
  }
  return rows;
}

const person = {
  firstName: 'Jürgen',
  lastName: 'Groß',
  email: 'juergen.gross@codingforchange.com',
  password: 'Kt7m-X9rp-4wQh',
  recoveryEmail: 'j.gross@example.org',
};

describe('buildGoogleCsv', () => {
  it('starts with the exact header line of the Google template, byte for byte', () => {
    const csv = Buffer.from(buildGoogleCsv([], '/'), 'utf8');
    expect(csv.equals(fixture)).toBe(true);
    expect(GOOGLE_CSV_HEADER).toHaveLength(29);
    const withRows = Buffer.from(buildGoogleCsv([person], '/'), 'utf8');
    expect(withRows.subarray(0, fixture.length).equals(fixture)).toBe(true);
  });

  it('fills the right columns and leaves the rest empty', () => {
    const [header, row] = parse(buildGoogleCsv([person], '/Members/2026'));
    expect(row).toHaveLength(header.length);
    const byName = Object.fromEntries(header.map((h, i) => [h, row[i]]));
    expect(byName).toMatchObject({
      'First Name [Required]': 'Jürgen',
      'Last Name [Required]': 'Groß',
      'Email Address [Required]': 'juergen.gross@codingforchange.com',
      'Password [Required]': 'Kt7m-X9rp-4wQh',
      'Org Unit Path [Required]': '/Members/2026',
      'Recovery Email': 'j.gross@example.org',
      'Change Password at Next Sign-In': 'TRUE',
    });
    const filled = new Set([
      'First Name [Required]',
      'Last Name [Required]',
      'Email Address [Required]',
      'Password [Required]',
      'Org Unit Path [Required]',
      'Recovery Email',
      'Change Password at Next Sign-In',
    ]);
    for (const h of header) if (!filled.has(h)) expect(byName[h]).toBe('');
  });

  it('writes one CRLF line per person', () => {
    const csv = buildGoogleCsv([person, { ...person, email: 'b@codingforchange.com' }], '/');
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(4);
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('quotes commas and quotes, and keeps line breaks out of names', () => {
    const [, row] = parse(buildGoogleCsv([{ ...person, firstName: 'Anna, "Annie"', lastName: 'Line\nBreak' }], '/'));
    expect(row[0]).toBe('Anna, "Annie"');
    expect(row[1]).toBe('Line Break');
  });

  it('guards against spreadsheet formulas', () => {
    const [, row] = parse(
      buildGoogleCsv(
        [{ ...person, firstName: '=HYPERLINK("http://x")', lastName: '+-@Smith', recoveryEmail: '=1+1@evil.com' }],
        '=cmd|calc',
      ),
    );
    for (const cell of row) expect(cell).not.toMatch(/^[=+\-@\t\r]/);
    expect(row[0]).toBe('HYPERLINK("http://x")');
    expect(row[1]).toBe('Smith');
    expect(row[7]).toBe('');
  });

  it('defaults the org unit to /', () => {
    expect(safeOrgUnitPath('')).toBe('/');
    expect(safeOrgUnitPath(null)).toBe('/');
    expect(safeOrgUnitPath('Members/')).toBe('/Members');
  });

  it('refuses a row without a valid address', () => {
    expect(() => buildGoogleCsv([{ ...person, email: '-x' }], '/')).toThrow();
  });
});

describe('cell helpers', () => {
  it('quotes only when needed', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('cleans text and addresses', () => {
    expect(safeText('  @=Max \t ')).toBe('Max');
    expect(safeText('Anne-Marie')).toBe('Anne-Marie');
    expect(safeAddress('a@b.de')).toBe('a@b.de');
    expect(safeAddress('not an address')).toBe('');
    expect(safeAddress('@a@b.de')).toBe('');
  });
});
