import { describe, expect, it } from 'vitest';
import { manualAddresses, parseManualRow, planManualRows, privateAddressProblem, type ManualContext } from './manual';

const D = 'codingforchange.com';

const ctx = (over: Partial<ManualContext> = {}): ManualContext => ({
  domain: D,
  accountAddresses: new Set(),
  privateOwners: new Map(),
  admittedByPrivate: new Map(),
  applicationsInBatch: new Set(),
  inBatch: new Set(),
  ...over,
});

describe('privateAddressProblem', () => {
  it('accepts empty and plain addresses', () => {
    expect(privateAddressProblem('', D)).toBeNull();
    expect(privateAddressProblem('  ', D)).toBeNull();
    expect(privateAddressProblem('Max.Muster@Example.org', D)).toBeNull();
    expect(privateAddressProblem("o'brien+cfc@mail.example.co.uk", D)).toBeNull();
  });

  it('refuses what is not a plain address', () => {
    for (const v of ['max', 'max@', '@example.org', 'max at gmail.com', 'max@gmail', '=cmd@example.org', 'max.@example.org', 'a..b@example.org', 'max@-x.org']) {
      expect(privateAddressProblem(v, D), v).not.toBeNull();
    }
  });

  it('refuses the association domain', () => {
    expect(privateAddressProblem('max@CodingForChange.com', D)).toMatch(/cannot be on @codingforchange\.com/);
  });
});

describe('parseManualRow', () => {
  it('cleans names and lower-cases addresses', () => {
    expect(
      parseManualRow({ firstName: ' Jürgen ', lastName: '=Groß', email: 'Juergen.Gross@CodingForChange.com', privateEmail: ' J@Example.org ' }, D),
    ).toEqual({ row: { firstName: 'Jürgen', lastName: 'Groß', email: 'juergen.gross@codingforchange.com', privateEmail: 'j@example.org' } });
  });

  it('takes a missing or null private address as none', () => {
    expect(parseManualRow({ firstName: 'A', lastName: 'B', email: 'a.b@codingforchange.com' }, D)).toEqual({
      row: { firstName: 'A', lastName: 'B', email: 'a.b@codingforchange.com', privateEmail: '' },
    });
    expect(parseManualRow({ firstName: 'A', lastName: 'B', email: 'a.b@codingforchange.com', privateEmail: null }, D)).toMatchObject({
      row: { privateEmail: '' },
    });
  });

  it('needs both names, a good association address and a valid private one', () => {
    expect(parseManualRow({ firstName: '', lastName: 'B', email: 'b@codingforchange.com' }, D)).toEqual({ problem: 'First and last name are needed.' });
    expect(parseManualRow({ firstName: '@@', lastName: 'B', email: 'b@codingforchange.com' }, D)).toEqual({ problem: 'First and last name are needed.' });
    expect(parseManualRow({ firstName: 'A', lastName: 'B', email: 'a.b@gmail.com' }, D)).toMatchObject({ problem: expect.stringMatching(/Must end in/) });
    expect(parseManualRow({ firstName: 'A', lastName: 'B', email: '' }, D)).toMatchObject({ problem: 'Not an email address.' });
    expect(parseManualRow({ firstName: 'A', lastName: 'B', email: 'a.b@codingforchange.com', privateEmail: 'nope' }, D)).toMatchObject({
      problem: expect.stringMatching(/private address/),
    });
  });

  it('refuses anything but the expected shape', () => {
    for (const raw of [null, 'x', 3, [], { firstName: 'A', lastName: 'B' }, { firstName: 1, lastName: 'B', email: 'a@codingforchange.com' }, { firstName: 'A', lastName: 'B', email: 'a.b@codingforchange.com', privateEmail: 5 }]) {
      expect(parseManualRow(raw, D)).toHaveProperty('problem');
    }
  });
});

describe('planManualRows', () => {
  const row = (firstName: string, lastName: string, email: string, privateEmail?: string) => ({ firstName, lastName, email, privateEmail });

  it('plans good rows and names problems by index', () => {
    const out = planManualRows([row('Max', 'Muster', 'max.muster@codingforchange.com', 'max@example.org'), row('', 'X', 'x@codingforchange.com')], ctx());
    expect(out.planned).toEqual([{ firstName: 'Max', lastName: 'Muster', email: 'max.muster@codingforchange.com', privateEmail: 'max@example.org' }]);
    expect(out.problems).toEqual([{ manual: 1, message: 'First and last name are needed.' }]);
  });

  it('refuses addresses of accounts and addresses given twice, also to an applicant in the batch', () => {
    const c = ctx({ accountAddresses: new Set(['taken@codingforchange.com']), inBatch: new Set(['applicant@codingforchange.com']) });
    const out = planManualRows(
      [
        row('A', 'B', 'TAKEN@codingforchange.com'),
        row('A', 'B', 'applicant@codingforchange.com'),
        row('C', 'D', 'c.d@codingforchange.com'),
        row('C', 'D', 'c.d@codingforchange.com'),
      ],
      c,
    );
    expect(out.planned.map((p) => p.email)).toEqual(['c.d@codingforchange.com']);
    expect(out.problems).toEqual([
      { manual: 0, message: 'taken@codingforchange.com belongs to an account already.', conflict: true },
      { manual: 1, message: 'applicant@codingforchange.com is given to two people.' },
      { manual: 3, message: 'c.d@codingforchange.com is given to two people.' },
    ]);
    expect(c.inBatch.has('c.d@codingforchange.com')).toBe(true);
  });

  it('never makes a second account for one private address', () => {
    const c = ctx({
      privateOwners: new Map([['has@example.org', 'has.account@codingforchange.com']]),
      admittedByPrivate: new Map([
        ['applied@example.org', 7],
        ['selected@example.org', 8],
      ]),
      applicationsInBatch: new Set([8]),
    });
    const out = planManualRows(
      [
        row('A', 'A', 'a.a@codingforchange.com', 'Has@Example.org'),
        row('B', 'B', 'b.b@codingforchange.com', 'applied@example.org'),
        row('C', 'C', 'c.c@codingforchange.com', 'selected@example.org'),
        row('D', 'D', 'd.d@codingforchange.com', 'same@example.org'),
        row('E', 'E', 'e.e@codingforchange.com', 'same@example.org'),
        row('F', 'F', 'f.f@codingforchange.com'),
        row('G', 'G', 'g.g@codingforchange.com'),
      ],
      c,
    );
    expect(out.planned.map((p) => p.email)).toEqual(['d.d@codingforchange.com', 'f.f@codingforchange.com', 'g.g@codingforchange.com']);
    expect(out.problems.map((p) => [p.manual, p.conflict ?? false])).toEqual([
      [0, true],
      [1, false],
      [2, false],
      [4, false],
    ]);
    expect(out.problems[0].message).toMatch(/has\.account@codingforchange\.com/);
    expect(out.problems[1].message).toMatch(/admitted application/);
    expect(out.problems[2].message).toMatch(/Selected above/);
    expect(c.inBatch.has('e.e@codingforchange.com')).toBe(false);
  });
});

describe('manualAddresses', () => {
  const m = (firstName: string, lastName: string, email = '', edited = false) => ({ firstName, lastName, email, edited });

  it('proposes free of accounts, applicant rows and the manual rows above', () => {
    expect(
      manualAddresses(
        [m('Max', 'Mustermann'), m('Max', 'Mustermann'), m('Jürgen', 'Groß'), m('', '')],
        D,
        ['MAX.MUSTERMANN@codingforchange.com'],
        ['max.mustermann2@codingforchange.com', ''],
      ),
    ).toEqual(['max.mustermann3@codingforchange.com', 'max.mustermann4@codingforchange.com', 'juergen.gross@codingforchange.com', null]);
  });

  it('keeps a typed address and keeps the proposals clear of it, wherever it is in the list', () => {
    expect(
      manualAddresses([m('Anna', 'Schmidt'), m('X', 'Y', 'anna.schmidt@codingforchange.com', true)], D, [], []),
    ).toEqual(['anna.schmidt2@codingforchange.com', 'anna.schmidt@codingforchange.com']);
  });

  it('follows the applicant rows as the board edits them', () => {
    expect(manualAddresses([m('Lea', 'Kim')], D, [], ['lea.kim@codingforchange.com'])).toEqual(['lea.kim2@codingforchange.com']);
    expect(manualAddresses([m('Lea', 'Kim')], D, [], ['lea.k@codingforchange.com'])).toEqual(['lea.kim@codingforchange.com']);
  });
});
