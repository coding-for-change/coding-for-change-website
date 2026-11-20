import { describe, expect, it } from 'vitest';
import { addressPart, addressProblem, proposeAddress, proposeAddresses } from './cfcEmail';
import { applicantOf } from './applicant';

const D = 'codingforchange.com';

describe('addressPart', () => {
  it('spells out umlauts and ß', () => {
    expect(addressPart('Jürgen')).toBe('juergen');
    expect(addressPart('Öztürk')).toBe('oeztuerk');
    expect(addressPart('Äbersold')).toBe('aebersold');
    expect(addressPart('Groß')).toBe('gross');
    expect(addressPart('GROẞ')).toBe('gross');
  });

  it('drops other accents and special letters', () => {
    expect(addressPart('José')).toBe('jose');
    expect(addressPart('Françoise')).toBe('francoise');
    expect(addressPart('Łukasz')).toBe('lukasz');
    expect(addressPart('Søren')).toBe('soren');
    expect(addressPart('Đorđe')).toBe('dorde');
    expect(addressPart('Nguyễn')).toBe('nguyen');
  });

  it('joins words of one name with hyphens and drops what an address cannot hold', () => {
    expect(addressPart('Anna Maria')).toBe('anna-maria');
    expect(addressPart('  Müller-Lüdenscheidt ')).toBe('mueller-luedenscheidt');
    expect(addressPart('von der  Leyen')).toBe('von-der-leyen');
    expect(addressPart("O'Brien")).toBe('obrien');
    expect(addressPart('Jean-Luc.')).toBe('jean-luc');
    expect(addressPart('李')).toBe('');
  });
});

describe('proposeAddress', () => {
  it('builds vorname.nachname@domain', () => {
    expect(proposeAddress('Max', 'Mustermann', D, new Set())).toBe('max.mustermann@codingforchange.com');
    expect(proposeAddress('Anna Maria', 'Müller-Lüdenscheidt', D, new Set())).toBe(
      'anna-maria.mueller-luedenscheidt@codingforchange.com',
    );
  });

  it('uses the one name there is, and gives up without any', () => {
    expect(proposeAddress('', 'Mustermann', D, new Set())).toBe('mustermann@codingforchange.com');
    expect(proposeAddress('李', '王', D, new Set())).toBeNull();
  });

  it('numbers a taken address', () => {
    const taken = new Set(['max.mustermann@codingforchange.com', 'max.mustermann2@codingforchange.com']);
    expect(proposeAddress('Max', 'Mustermann', D, taken)).toBe('max.mustermann3@codingforchange.com');
  });
});

describe('proposeAddresses', () => {
  it('keeps people in one batch apart from each other and from existing accounts, in any case', () => {
    const out = proposeAddresses(
      [
        { firstName: 'Max', lastName: 'Mustermann' },
        { firstName: 'Max', lastName: 'Mustermann' },
        { firstName: 'Jürgen', lastName: 'Groß' },
        { firstName: '', lastName: '' },
      ],
      D,
      ['MAX.Mustermann@codingforchange.com'],
    );
    expect(out).toEqual([
      'max.mustermann2@codingforchange.com',
      'max.mustermann3@codingforchange.com',
      'juergen.gross@codingforchange.com',
      null,
    ]);
  });
});

describe('addressProblem', () => {
  it('accepts a good address on the domain, in any case', () => {
    expect(addressProblem('max.mustermann@codingforchange.com', D)).toBeNull();
    expect(addressProblem(' Max.Mustermann2@CodingForChange.com ', D)).toBeNull();
  });

  it('refuses other domains and malformed addresses', () => {
    expect(addressProblem('max@gmail.com', D)).toMatch(/codingforchange/);
    expect(addressProblem('max', D)).toMatch(/email/);
    expect(addressProblem('.max@codingforchange.com', D)).not.toBeNull();
    expect(addressProblem('max.@codingforchange.com', D)).not.toBeNull();
    expect(addressProblem('max..m@codingforchange.com', D)).not.toBeNull();
    expect(addressProblem('=cmd@codingforchange.com', D)).not.toBeNull();
    expect(addressProblem('jürgen@codingforchange.com', D)).not.toBeNull();
    expect(addressProblem(`${'a'.repeat(65)}@codingforchange.com`, D)).not.toBeNull();
  });
});

describe('applicantOf', () => {
  const s = (rows: [string, string][]) => ({ submissionData: rows.map(([field, value]) => ({ field, value })) });

  it('reads first name, last name and the private address', () => {
    expect(applicantOf(s([['firstName', ' Jürgen '], ['lastName', 'Groß'], ['email', 'J.Gross@Example.org']]))).toEqual({
      firstName: 'Jürgen',
      lastName: 'Groß',
      privateEmail: 'j.gross@example.org',
    });
  });

  it('splits a single name question at the last word', () => {
    expect(applicantOf(s([['name', 'Anna Maria Schmidt'], ['email', 'a@b.de']]))).toMatchObject({
      firstName: 'Anna Maria',
      lastName: 'Schmidt',
    });
  });
});
