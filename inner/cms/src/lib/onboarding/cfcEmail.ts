/**
 * The association address for a new member: `vorname.nachname@domain`
 * (lib/onboarding, the board's "Create accounts" in /admin/onboarding).
 *
 * - German umlauts and ß are spelled out (ä → ae, ö → oe, ü → ue, ß → ss),
 *   the way Germans write them without the letters; every other accent is
 *   dropped (é → e, ł → l).
 * - A name of several words or a double name keeps its parts joined by a
 *   hyphen, so first and last name stay apart at the one dot:
 *   "Anna Maria" + "Müller-Lüdenscheidt" → anna-maria.mueller-luedenscheidt.
 * - Anything Google does not allow in an address is left out.
 * - An address that is taken (an existing account, or one handed out earlier
 *   in the same batch) gets a number: max.mustermann2, max.mustermann3, ...
 *
 * Pure: the caller passes what is taken.
 */

const SPELLED_OUT: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  ẞ: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  å: 'a',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ı: 'i',
};

/** One name (first or last) as it goes into an address: lower case, a-z, 0-9 and hyphens. */
export function addressPart(name: string): string {
  const lower = name.normalize('NFC').toLowerCase();
  const spelled = [...lower].map((c) => SPELLED_OUT[c] ?? c).join('');
  return spelled
    .normalize('NFD')
    .replace(/\p{M}+/gu, '') // the accents NFD split off
    .replace(/['’`´]/g, '') // O'Brien → obrien
    .replace(/[^a-z0-9]+/g, '-') // spaces, hyphens, dots and anything else between words
    .replace(/^-+|-+$/g, '');
}

/** The local part before any number: "first.last", or the one name there is; '' when neither has a letter or digit. */
export function baseLocalPart(firstName: string, lastName: string): string {
  return [addressPart(firstName), addressPart(lastName)].filter(Boolean).join('.');
}

/** The lower-cased local part and domain of what is in `taken`, for comparing. */
const norm = (address: string) => address.trim().toLowerCase();

/**
 * The first free address for this person, or null when the name gives nothing
 * to build one from (the board types it then). `taken` holds every address in
 * use, in any case; the caller adds the result to it before the next person
 * of a batch.
 */
export function proposeAddress(
  firstName: string,
  lastName: string,
  domain: string,
  taken: ReadonlySet<string>,
): string | null {
  const base = baseLocalPart(firstName, lastName).slice(0, 60).replace(/[.-]+$/, '');
  if (!base) return null;
  const at = `@${domain.toLowerCase()}`;
  if (!taken.has(base + at)) return base + at;
  for (let n = 2; ; n++) {
    const candidate = `${base}${n}${at}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Addresses for a batch, in order, each free of the existing ones and of those before it. */
export function proposeAddresses(
  people: { firstName: string; lastName: string }[],
  domain: string,
  existing: Iterable<string>,
): (string | null)[] {
  const taken = new Set([...existing].map(norm));
  return people.map((p) => {
    const address = proposeAddress(p.firstName, p.lastName, domain, taken);
    if (address) taken.add(address);
    return address;
  });
}

/**
 * Why an address the board typed cannot be used, or null when it can: it has
 * to be on the association's domain and look like one Google accepts
 * (letters, digits, dots, hyphens, underscores; no dot at either end or two in
 * a row; at most 64 characters before the @).
 */
export function addressProblem(address: string, domain: string): string | null {
  const value = norm(address);
  const at = value.lastIndexOf('@');
  if (at < 1) return 'Not an email address.';
  const local = value.slice(0, at);
  if (value.slice(at + 1) !== domain.toLowerCase()) return `Must end in @${domain.toLowerCase()}.`;
  if (local.length > 64) return 'Too long before the @ (at most 64 characters).';
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(local)) return 'Only letters, digits, dots, hyphens and underscores, starting with a letter or digit.';
  if (local.endsWith('.') || local.includes('..')) return 'No dot at the end and no two dots in a row.';
  return null;
}

export const normalizeAddress = norm;
