import {
  matches,
  mailFor,
  problemsOf,
  SOURCES,
  type MailingConfig,
  type MailLang,
  type PersonProps,
  type SourceKey,
} from './model';

/**
 * Who gets which mail: the people of a source sorted into a mailing's groups.
 * Pure, so the endpoints can run it on the people they read and the admin
 * screen can trust that the check it shows is the one the send runs again.
 *
 * People are counted by address, not by entry: someone who applied twice (or
 * through the full form and the speedrun) is one person and gets one mail –
 * from the first group any of their entries fits. A source with `perEntry`
 * (the TechTour: a personal link per registration) counts entries instead.
 */

/** One entry of a source as read from the database (sources.ts). */
export type Candidate = {
  submission?: number;
  waitlistSignup?: number;
  email: string;
  name: string;
  firstName: string;
  lang: MailLang;
  props: PersonProps;
};

export type ResolvedPerson = {
  email: string;
  name: string;
  firstName: string;
  lang: MailLang;
  submission?: number;
  waitlistSignup?: number;
  /** How many entries this address has in the source. */
  entries: number;
  /** "Accepted · score 8 · Speedrun" – what the source knows, in short. */
  detail: string;
};

export type ResolvedGroup = {
  id: string;
  label: string;
  people: ResolvedPerson[];
  /** People who will get the other language's text because theirs is not written. */
  fallback: number;
};

/**
 * What this mailing already sent an address (status sent or still pending),
 * keyed by `recipientKey`.
 */
export type PreviousMail = { groupLabel: string; at: string };

export type Resolution = {
  groups: ResolvedGroup[];
  /** Fit no group – get nothing. */
  unassigned: ResolvedPerson[];
  /** Fit a group, but this mailing already reached them (`onlyOnce`). */
  alreadySent: (ResolvedPerson & { group: string; previous: PreviousMail })[];
  /** Entries without a usable address. */
  invalid: number;
  /** Mails a send would deliver now. */
  toSend: number;
  /** Reasons the send button stays off. */
  problems: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Who counts as one recipient: the address, or – for a `perEntry` source – the entry. */
export const recipientKey = (perEntry: boolean, r: { email: string; submission?: number | null }): string =>
  perEntry && r.submission != null ? `s:${r.submission}` : r.email.trim().toLowerCase();

export function resolveMailing(
  source: SourceKey,
  config: MailingConfig,
  candidates: Candidate[],
  previous: Map<string, PreviousMail>,
): Resolution {
  const def = SOURCES[source];
  const byEmail = new Map<string, Candidate[]>();
  let invalid = 0;
  for (const c of candidates) {
    const email = c.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      invalid += 1;
      continue;
    }
    const key = recipientKey(def.perEntry, { email, submission: c.submission });
    byEmail.set(key, [...(byEmail.get(key) ?? []), { ...c, email }]);
  }

  const groups: ResolvedGroup[] = config.groups.map((g) => ({ id: g.id, label: g.label, people: [], fallback: 0 }));
  const unassigned: ResolvedPerson[] = [];
  const alreadySent: Resolution['alreadySent'] = [];

  for (const [key, entries] of byEmail) {
    let hit: { index: number; entry: Candidate } | null = null;
    for (let i = 0; i < config.groups.length && !hit; i++) {
      const entry = entries.find((c) => matches(def.filters, config.groups[i].filter, c.props));
      if (entry) hit = { index: i, entry };
    }
    const entry = hit?.entry ?? entries[entries.length - 1];
    const person: ResolvedPerson = {
      email: entry.email,
      name: entry.name || entry.email,
      firstName: entry.firstName,
      lang: entry.lang,
      submission: entry.submission,
      waitlistSignup: entry.waitlistSignup,
      entries: entries.length,
      detail: def.describe(entry.props),
    };
    if (!hit) {
      unassigned.push(person);
      continue;
    }
    const sentBefore = config.onlyOnce ? previous.get(key) : undefined;
    if (sentBefore) {
      alreadySent.push({ ...person, group: config.groups[hit.index].label, previous: sentBefore });
      continue;
    }
    groups[hit.index].people.push(person);
    if (mailFor(config.groups[hit.index], person.lang)?.fallback) groups[hit.index].fallback += 1;
  }

  const byName = (a: ResolvedPerson, b: ResolvedPerson) => a.name.localeCompare(b.name, 'de');
  for (const g of groups) g.people.sort(byName);
  unassigned.sort(byName);
  alreadySent.sort(byName);

  const langsInUse = Object.fromEntries(
    groups.map((g) => [g.id, [...new Set(g.people.map((p) => p.lang))]]),
  ) as Record<string, MailLang[]>;
  const toSend = groups.reduce((n, g) => n + g.people.length, 0);
  const problems = problemsOf(source, config, langsInUse);
  if (config.requireAll && unassigned.length) {
    const n = unassigned.length;
    problems.push(`${n} ${n === 1 ? def.noun.one : def.noun.many} fit no group – decide on them first, or turn off “Only send when everyone is in a group”.`);
  }
  if (!toSend) problems.push(alreadySent.length ? 'Everyone in the groups has had this mailing already.' : 'Nobody is in any group.');

  return { groups, unassigned, alreadySent, invalid, toSend, problems };
}

/** Group id → number of mails, the way the send endpoint checks that nothing moved since the check. */
export const countsOf = (r: Resolution): Record<string, number> =>
  Object.fromEntries(r.groups.map((g) => [g.id, g.people.length]));
