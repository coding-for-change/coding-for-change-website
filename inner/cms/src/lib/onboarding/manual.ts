import { addressProblem, normalizeAddress, proposeAddress } from './cfcEmail';
import { safeAddress, safeText } from './googleCsv';

/**
 * People the board adds by hand in /admin/onboarding: contacted directly,
 * never applied through the portal, so there is no application. They exist
 * only in the browser until "Create accounts", which sends them as
 * `manual: [{ firstName, lastName, email, privateEmail? }]` next to the
 * applicants (endpoints/onboarding.ts). Pure, so it can be tested.
 */

export type ManualRow = { firstName: string; lastName: string; email: string; privateEmail: string };

/** Payload's own check of an `email` field (fields/validations.js), so a stored privateEmail can never fail the batch. */
const PAYLOAD_EMAIL =
  /^(?!.*\.\.)[\w!#$%&'*+/=?^`{|}~-](?:[\w!#$%&'*+/=?^`{|}~.-]*[\w!#$%&'*+/=?^`{|}~-])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

/**
 * Why a private address cannot be used, or null when it can (empty is fine:
 * the account then has no recovery address). It must be a plain address, as
 * the Google CSV and the `privateEmail` field both accept it, and not one on
 * the association's own domain (that would be no recovery address at all).
 */
export function privateAddressProblem(value: string, domain: string): string | null {
  const v = normalizeAddress(value);
  if (!v) return null;
  if (v.length > 254 || !safeAddress(v) || !PAYLOAD_EMAIL.test(v)) return 'The private address is not a valid email address.';
  if (v.endsWith(`@${domain.toLowerCase()}`)) return `The private address cannot be on @${domain.toLowerCase()}.`;
  return null;
}

/** One row as sent, cleaned and checked on its own (names, address format and domain, private address). */
export function parseManualRow(raw: unknown, domain: string): { row: ManualRow } | { problem: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (
    typeof raw !== 'object' ||
    raw === null ||
    typeof r.firstName !== 'string' ||
    typeof r.lastName !== 'string' ||
    typeof r.email !== 'string' ||
    (r.privateEmail != null && typeof r.privateEmail !== 'string')
  ) {
    return { problem: 'Expected { firstName, lastName, email, privateEmail? }.' };
  }
  const firstName = safeText(r.firstName);
  const lastName = safeText(r.lastName);
  if (!firstName || !lastName) return { problem: 'First and last name are needed.' };
  const email = normalizeAddress(r.email);
  const wrong = addressProblem(email, domain);
  if (wrong) return { problem: wrong };
  const privateEmail = normalizeAddress((r.privateEmail as string | null | undefined) ?? '');
  const badPrivate = privateAddressProblem(privateEmail, domain);
  if (badPrivate) return { problem: badPrivate };
  return { row: { firstName, lastName, email, privateEmail } };
}

export type ManualProblem = { manual: number; message: string; conflict?: boolean };

export type ManualContext = {
  domain: string;
  /** Every account's address, lower case. */
  accountAddresses: ReadonlySet<string>;
  /** Private address (lower case) → the address of the account that has it. */
  privateOwners: ReadonlyMap<string, string>;
  /** Private address (lower case) → the admitted application without an account that has it. */
  admittedByPrivate: ReadonlyMap<string, number>;
  /** Applications created in the same batch. */
  applicationsInBatch: ReadonlySet<number>;
  /** Association addresses given out earlier in the batch (to the applicants); extended with these rows'. */
  inBatch: Set<string>;
};

/**
 * Every manual row of a batch checked against the accounts, the admitted
 * applications and the rest of the batch. Problems name the row by its
 * index in `rows`. `conflict` marks a problem the page may simply be out of
 * date for (an account made meanwhile), as for applicant rows.
 */
export function planManualRows(rows: unknown[], ctx: ManualContext): { planned: ManualRow[]; problems: ManualProblem[] } {
  const planned: ManualRow[] = [];
  const problems: ManualProblem[] = [];
  const privateInBatch = new Set<string>();
  rows.forEach((raw, manual) => {
    const parsed = parseManualRow(raw, ctx.domain);
    if ('problem' in parsed) {
      problems.push({ manual, message: parsed.problem });
      return;
    }
    const { row } = parsed;
    if (ctx.accountAddresses.has(row.email)) {
      problems.push({ manual, message: `${row.email} belongs to an account already.`, conflict: true });
      return;
    }
    if (ctx.inBatch.has(row.email)) {
      problems.push({ manual, message: `${row.email} is given to two people.` });
      return;
    }
    if (row.privateEmail) {
      const owner = ctx.privateOwners.get(row.privateEmail);
      if (owner) {
        problems.push({
          manual,
          message: `${row.privateEmail} is the private address of ${owner} already. One account per person: no second one is created.`,
          conflict: true,
        });
        return;
      }
      const application = ctx.admittedByPrivate.get(row.privateEmail);
      if (application !== undefined) {
        problems.push({
          manual,
          message: ctx.applicationsInBatch.has(application)
            ? `Selected above from their application too. Remove this row.`
            : `Has an admitted application with ${row.privateEmail}. Create the account from that application instead.`,
        });
        return;
      }
      if (privateInBatch.has(row.privateEmail)) {
        problems.push({ manual, message: `${row.privateEmail} is given to two people.` });
        return;
      }
      privateInBatch.add(row.privateEmail);
    }
    ctx.inBatch.add(row.email);
    planned.push(row);
  });
  return { planned, problems };
}

/**
 * The association address of each manual row as the dashboard shows it: the
 * board's own once they typed one (`edited`), otherwise the proposal from the
 * names, by the same rule as for applicants (cfcEmail.ts), free of every
 * account, of every address in `listed` (the applicant rows) and of the
 * manual rows before it. Null when the names give none.
 */
export function manualAddresses(
  rows: { firstName: string; lastName: string; email: string; edited: boolean }[],
  domain: string,
  accounts: Iterable<string>,
  listed: Iterable<string>,
): (string | null)[] {
  const taken = new Set<string>();
  for (const a of accounts) taken.add(normalizeAddress(a));
  for (const a of listed) if (a.trim()) taken.add(normalizeAddress(a));
  for (const r of rows) if (r.edited && r.email.trim()) taken.add(normalizeAddress(r.email));
  return rows.map((r) => {
    if (r.edited) return r.email;
    const address = proposeAddress(r.firstName, r.lastName, domain, taken);
    if (address) taken.add(address);
    return address;
  });
}
