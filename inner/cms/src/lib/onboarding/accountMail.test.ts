import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACCOUNT_MAIL_MESSAGE,
  DEFAULT_ACCOUNT_MAIL_SUBJECT,
  fillTemplate,
  parseCsv,
  readAccountCsv,
  templateProblem,
} from './accountMail';
import { buildGoogleCsv, GOOGLE_CSV_HEADER } from './googleCsv';

const people = [
  { firstName: 'Jürgen', lastName: 'Groß', email: 'juergen.gross@codingforchange.com', password: 'Abcd-efgh-2345', recoveryEmail: 'j@example.com' },
  { firstName: 'Anna Maria', lastName: 'Müller, geb. "Maier"', email: 'anna-maria.mueller@codingforchange.com', password: 'Wxyz-abcd-6789' },
];

describe('parseCsv', () => {
  it('reads quoted cells, doubled quotes, both line endings and a byte-order mark', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n"two\nlines",z\n\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['two\nlines', 'z'],
    ]);
  });
});

describe('readAccountCsv', () => {
  it('reads back what the dashboard downloads', () => {
    const read = readAccountCsv(buildGoogleCsv(people, '/'));
    expect(read.error).toBeNull();
    expect(read.problems).toEqual([]);
    expect(read.rows).toEqual(people.map(({ firstName, lastName, email, password }) => ({ firstName, lastName, email, password })));
  });

  it('finds the columns by name, in any order', () => {
    const header = [GOOGLE_CSV_HEADER[3], GOOGLE_CSV_HEADER[2], GOOGLE_CSV_HEADER[1], GOOGLE_CSV_HEADER[0]];
    const read = readAccountCsv(`${header.join(',')}\nSecret-1234,A@CodingForChange.com,Last,First\n`);
    expect(read.rows).toEqual([{ firstName: 'First', lastName: 'Last', email: 'a@codingforchange.com', password: 'Secret-1234' }]);
  });

  it('refuses a file that is not a Google users CSV', () => {
    expect(readAccountCsv('').error).toMatch(/empty/);
    expect(readAccountCsv('name,mail\nA,a@b.c\n').error).toMatch(/not the google-users\.csv/);
  });

  it('leaves out rows without a password or address and repeated addresses, and says so', () => {
    const head = GOOGLE_CSV_HEADER.join(',');
    const pad = ','.repeat(GOOGLE_CSV_HEADER.length - 4);
    const read = readAccountCsv(
      [head, `A,B,a@x.org,pw-1${pad}`, `C,D,c@x.org,${pad}`, `E,F,,pw-3${pad}`, `G,H,A@x.org,pw-4${pad}`].join('\r\n'),
    );
    expect(read.rows.map((r) => r.email)).toEqual(['a@x.org']);
    expect(read.problems).toHaveLength(3);
    // A problem never repeats a password.
    expect(read.problems.join(' ')).not.toMatch(/pw-/);
  });
});

describe('templateProblem', () => {
  it('accepts the default template', () => {
    expect(templateProblem(DEFAULT_ACCOUNT_MAIL_SUBJECT, DEFAULT_ACCOUNT_MAIL_MESSAGE)).toBeNull();
  });

  it('wants a subject, a message, the password and the address', () => {
    expect(templateProblem('', 'x {{password}} {{email}}')).toMatch(/subject/);
    expect(templateProblem('Hi', '')).toMatch(/message/);
    expect(templateProblem('Hi', 'only {{email}}')).toMatch(/\{\{password\}\}/);
    expect(templateProblem('Hi', 'only {{password}}')).toMatch(/\{\{email\}\}/);
  });

  it('refuses unknown placeholders, a password in the subject and a subject of several lines', () => {
    expect(templateProblem('Hi', '{{password}} {{email}} {{name}}')).toMatch(/Unknown placeholder \{\{name\}\}/);
    expect(templateProblem('Your {{password}}', '{{password}} {{email}}')).toMatch(/subject/);
    expect(templateProblem('Hi\nBcc: x', '{{password}} {{email}}')).toMatch(/one line/);
  });
});

describe('fillTemplate', () => {
  it('fills every placeholder, with or without spaces', () => {
    const values = { firstName: 'Ada', lastName: 'L', email: 'ada@x.org', password: 'pw', onboardingUrl: 'https://x/onboarding' };
    expect(fillTemplate('Hi {{firstName}} {{ lastName }}: {{email}} / {{password}} at {{onboardingUrl}}', values)).toBe(
      'Hi Ada L: ada@x.org / pw at https://x/onboarding',
    );
  });

  it('does not expand placeholders that arrive inside a value', () => {
    const values = { firstName: '{{password}}', lastName: '', email: 'e', password: 'pw', onboardingUrl: 'u' };
    expect(fillTemplate('{{firstName}}', values)).toBe('{{password}}');
  });
});
