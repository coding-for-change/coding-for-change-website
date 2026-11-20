import { randomInt } from 'node:crypto';

/**
 * The first Google password of a new member, printed on their sheet
 * (lib/onboarding/sheets.ts) and set through the bulk-upload CSV
 * (googleCsv.ts), with "change at next sign-in" on. It exists only inside the
 * request that makes the download: never stored, never logged.
 *
 * Easy to type from paper: three groups of four, joined by hyphens
 * ("Kt7m-X9rp-4wQh"), from letters and digits that cannot be mistaken for
 * one another on a printout (no 0/O/o, 1/l/I/i). Every password has an upper
 * case letter, a lower case letter and a digit, and is 14 characters long:
 * well above Google's minimum of 8, within its maximum of 100, ASCII only and
 * no space anywhere, so it passes Google's default password rules and its
 * "strong password" setting. About 69 bits of randomness from
 * `crypto.randomInt`, ample for a password that has to be changed at the first
 * sign-in.
 */

export const LOWER = 'abcdefghjkmnpqrstuvwxyz';
export const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const DIGITS = '23456789';
export const PASSWORD_ALPHABET = LOWER + UPPER + DIGITS;

const GROUPS = 3;
const GROUP_LENGTH = 4;

const pick = (alphabet: string) => alphabet[randomInt(alphabet.length)];

/** A fresh password; draws again in the rare case one of the three kinds is missing. */
export function generatePassword(): string {
  for (;;) {
    const chars = Array.from({ length: GROUPS * GROUP_LENGTH }, () => pick(PASSWORD_ALPHABET));
    const s = chars.join('');
    if (![LOWER, UPPER, DIGITS].every((kind) => [...s].some((c) => kind.includes(c)))) continue;
    const groups: string[] = [];
    for (let g = 0; g < GROUPS; g++) groups.push(s.slice(g * GROUP_LENGTH, (g + 1) * GROUP_LENGTH));
    return groups.join('-');
  }
}

/** Google's default rules, for the tests and as a last check before a password leaves the server. */
export function meetsGoogleRules(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 100 &&
    /^[\x21-\x7e]+$/.test(password) &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}
