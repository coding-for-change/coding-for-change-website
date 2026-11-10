import { describe, expect, it } from 'vitest';
import { generatePassword, meetsGoogleRules, PASSWORD_ALPHABET } from './password';

describe('generatePassword', () => {
  const many = Array.from({ length: 2000 }, generatePassword);

  it('is three groups of four, joined by hyphens', () => {
    for (const p of many) expect(p).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
  });

  it('uses no characters that look alike on paper', () => {
    for (const p of many) expect(p).not.toMatch(/[0O1lIio]/);
    expect(PASSWORD_ALPHABET).not.toMatch(/[0O1lIio]/);
  });

  it("always meets Google's default rules (length, upper, lower, digit, no spaces)", () => {
    for (const p of many) expect(meetsGoogleRules(p)).toBe(true);
  });

  it('does not repeat', () => {
    expect(new Set(many).size).toBe(many.length);
  });

  it('uses the whole alphabet (it is random, not a pattern)', () => {
    const seen = new Set(many.join('').replace(/-/g, ''));
    expect(seen.size).toBe(PASSWORD_ALPHABET.length);
  });
});

describe('meetsGoogleRules', () => {
  it('refuses short, spaced or one-kind passwords', () => {
    expect(meetsGoogleRules('Ab3')).toBe(false);
    expect(meetsGoogleRules('abcd efgh 23A')).toBe(false);
    expect(meetsGoogleRules('abcdefgh')).toBe(false);
    expect(meetsGoogleRules('Abcdefg2')).toBe(true);
  });
});
