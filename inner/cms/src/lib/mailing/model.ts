/**
 * The mailing tool (/admin/mailing): one place to write to the people in the
 * CMS – the membership applications, the waitlist and the TechTour
 * registrations – instead of a mail button per collection.
 *
 * A mailing goes to one source and splits it into groups. Each group says who
 * is in it (filters on what the source knows about a person: decision, score,
 * speedrun, language …) and what they get (subject, text and an optional
 * button, in German and English). The groups are checked in order and a person
 * gets the mail of the first group they fit, so "Speedrun → Accepted →
 * Rejected" sends each applicant exactly one of the three.
 *
 * This file is the shared part: types, the filters each source offers and how
 * a filter matches. Dependency-free, so both the admin screen (client) and the
 * endpoints (endpoints/mailing.ts) use the same rules. Reading the people of a
 * source is server-only (sources.ts).
 */

export type MailLang = 'de' | 'en';
export const MAIL_LANGS: MailLang[] = ['en', 'de'];

/** The sources a mailing can go to. One per kind of person the CMS keeps. */
export type SourceKey = 'applications' | 'waitlist' | 'techtour';

export type ChoiceFilterDef = {
  key: string;
  label: string;
  kind: 'choice';
  options: { value: string; label: string }[];
  /** The options come from the data (the TechTour's evenings) – filled in by the server (sources.ts). */
  dynamic?: boolean;
};
export type RangeFilterDef = { key: string; label: string; kind: 'range'; min: number; max: number };
export type FlagFilterDef = { key: string; label: string; kind: 'flag' };
export type FilterDef = ChoiceFilterDef | RangeFilterDef | FlagFilterDef;

/** A choice filter: the values allowed (none = anyone). On a list (a person's evenings) one in common is enough. */
export type ChoiceFilter = string[];
/** A range filter: inclusive bounds; a person without a value never matches a set bound. */
export type RangeFilter = { min?: number | null; max?: number | null };
/** A flag filter: either way, only those with it, only those without. */
export type FlagFilter = 'any' | 'yes' | 'no';
export type FilterValue = ChoiceFilter | RangeFilter | FlagFilter;

export type SourceDef = {
  key: SourceKey;
  label: string;
  /** "people" in the counts: "12 applicants". */
  noun: { one: string; many: string };
  filters: FilterDef[];
  /** Why the recipient gets the mail – the footer line of lib/waitlistEmailTemplate.ts. */
  audience: 'applications' | 'waitlist' | 'techtour';
  /** What the source knows about a person, in short, for the lists. */
  describe: (props: PersonProps) => string;
  /** The `{{…}}` fields this source fills in per person. */
  placeholders: Placeholder[];
  /**
   * One mail per entry instead of per address: each TechTour registration has
   * its own /techtour/manage link, so someone registered twice gets both.
   */
  perEntry: boolean;
  /** Add a List-Unsubscribe header (lists people signed up to, not replies to an application). */
  unsubscribe: boolean;
};

export type Placeholder = 'firstName' | 'link' | 'manageLink';

/** What each `{{…}}` becomes, for the hint under the text. */
export const PLACEHOLDER_HELP: Record<Placeholder, string> = {
  firstName: 'the person’s first name',
  link: 'the button link',
  manageLink: 'their own /techtour/manage link (also works as the button link)',
};

const LANGUAGE_FILTER: ChoiceFilterDef = {
  key: 'language',
  label: 'Language',
  kind: 'choice',
  options: [
    { value: 'en', label: 'English' },
    { value: 'de', label: 'German' },
  ],
};

const STATUS_LABELS: Record<string, string> = {
  accepted: 'Accepted',
  rejected: 'Rejected',
  unsure: 'Unsure',
  unreviewed: 'Unreviewed',
};

export const SOURCES: Record<SourceKey, SourceDef> = {
  applications: {
    key: 'applications',
    label: 'Membership applications',
    noun: { one: 'applicant', many: 'applicants' },
    audience: 'applications',
    placeholders: ['firstName', 'link'],
    perEntry: false,
    unsubscribe: false,
    describe: (p) =>
      [
        STATUS_LABELS[String(p.status)] ?? 'Unreviewed',
        typeof p.score === 'number' ? `score ${p.score}` : 'no score',
        p.speedrun === true ? 'Speedrun' : '',
      ]
        .filter(Boolean)
        .join(' · '),
    filters: [
      {
        key: 'status',
        label: 'Decision',
        kind: 'choice',
        options: [
          { value: 'accepted', label: 'Accepted' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'unsure', label: 'Unsure' },
          { value: 'unreviewed', label: 'Unreviewed' },
        ],
      },
      { key: 'score', label: 'Score', kind: 'range', min: 1, max: 10 },
      { key: 'speedrun', label: 'Speedrun', kind: 'flag' },
      LANGUAGE_FILTER,
    ],
  },
  waitlist: {
    key: 'waitlist',
    label: 'Waitlist',
    noun: { one: 'address', many: 'addresses' },
    audience: 'waitlist',
    placeholders: ['link'],
    perEntry: false,
    unsubscribe: true,
    describe: (p) => (p.language === 'unknown' ? 'no language recorded' : p.language === 'de' ? 'signed up in German' : 'signed up in English'),
    filters: [
      {
        ...LANGUAGE_FILTER,
        options: [...LANGUAGE_FILTER.options, { value: 'unknown', label: 'Not recorded' }],
      },
    ],
  },
  techtour: {
    key: 'techtour',
    label: 'TechTour registrations',
    noun: { one: 'registration', many: 'registrations' },
    audience: 'techtour',
    placeholders: ['firstName', 'link', 'manageLink'],
    perEntry: true,
    unsubscribe: true,
    describe: (p) => {
      const list = (v: unknown) => (Array.isArray(v) ? v.length : 0);
      return [
        `${list(p.evening)} evening${list(p.evening) === 1 ? '' : 's'}`,
        list(p.admitted) ? `admitted to ${list(p.admitted)}` : '',
        list(p.declined) ? `declined for ${list(p.declined)}` : '',
        p.member === true ? 'member' : '',
      ]
        .filter(Boolean)
        .join(' · ');
    },
    filters: [
      { key: 'evening', label: 'Registered for', kind: 'choice', options: [], dynamic: true },
      { key: 'admitted', label: 'Host admitted them to', kind: 'choice', options: [], dynamic: true },
      { key: 'declined', label: 'Host declined them for', kind: 'choice', options: [], dynamic: true },
      { key: 'member', label: 'Coding for Change member', kind: 'flag' },
      LANGUAGE_FILTER,
    ],
  },
};

export const isSourceKey = (v: unknown): v is SourceKey => typeof v === 'string' && v in SOURCES;

export type GroupMail = { subject: string; message: string; ctaLabel: string };

export type MailingGroup = {
  /** Stable within the mailing (recipients point at it). */
  id: string;
  label: string;
  filter: Record<string, FilterValue>;
  mail: Record<MailLang, GroupMail>;
  /** The button's link, the same in both languages; empty = no button. */
  ctaUrl: string;
};

export type MailingConfig = {
  groups: MailingGroup[];
  /** Skip everyone this mailing already reached – send again and only the new ones get it. */
  onlyOnce: boolean;
  /** Refuse to send while someone fits no group (e.g. still unreviewed). */
  requireAll: boolean;
  /** Optional image under the logo, for every group (absolute http(s) URL, e.g. from Media). */
  headerImageUrl: string;
};

/** What a person looks like to the filters. A list (the evenings) matches a choice when one value is in common. */
export type PersonProps = Record<string, string | number | boolean | string[] | null>;

export function matches(filters: FilterDef[], filter: Record<string, FilterValue>, props: PersonProps): boolean {
  for (const def of filters) {
    const want = filter[def.key];
    const have = props[def.key];
    if (want == null) continue;
    if (def.kind === 'choice') {
      const allowed = Array.isArray(want) ? want : [];
      if (!allowed.length) continue;
      if (Array.isArray(have) ? !have.some((v) => allowed.includes(v)) : !allowed.includes(String(have ?? ''))) return false;
    } else if (def.kind === 'range') {
      const { min, max } = (want as RangeFilter) ?? {};
      if (min == null && max == null) continue;
      if (typeof have !== 'number') return false;
      if (min != null && have < min) return false;
      if (max != null && have > max) return false;
    } else {
      if (want === 'yes' && have !== true) return false;
      if (want === 'no' && have === true) return false;
    }
  }
  return true;
}

/** "Decision: Accepted · Score ≥ 7" – a group's filter in words, for the lists. */
export function describeFilter(filters: FilterDef[], filter: Record<string, FilterValue>): string {
  const parts: string[] = [];
  for (const def of filters) {
    const want = filter[def.key];
    if (want == null) continue;
    if (def.kind === 'choice' && Array.isArray(want) && want.length) {
      parts.push(`${def.label}: ${want.map((v) => def.options.find((o) => o.value === v)?.label ?? v).join(' or ')}`);
    } else if (def.kind === 'range') {
      const { min, max } = want as RangeFilter;
      if (min != null && max != null) parts.push(`${def.label} ${min}–${max}`);
      else if (min != null) parts.push(`${def.label} ≥ ${min}`);
      else if (max != null) parts.push(`${def.label} ≤ ${max}`);
    } else if (def.kind === 'flag' && (want === 'yes' || want === 'no')) {
      parts.push(want === 'yes' ? def.label : `Not ${def.label.toLowerCase()}`);
    }
  }
  return parts.join(' · ') || 'Everyone';
}

export const emptyMail = (): GroupMail => ({ subject: '', message: '', ctaLabel: '' });

export const newGroupId = (): string => Math.random().toString(36).slice(2, 10);

export const emptyGroup = (label = 'New group'): MailingGroup => ({
  id: newGroupId(),
  label,
  filter: {},
  mail: { en: emptyMail(), de: emptyMail() },
  ctaUrl: '',
});

export const emptyConfig = (): MailingConfig => ({
  groups: [emptyGroup('Everyone')],
  onlyOnce: true,
  requireAll: false,
  headerImageUrl: '',
});

/**
 * The text a group uses for a person: their language, or the other one when
 * theirs is not written. Null when neither is.
 */
export function mailFor(group: MailingGroup, lang: MailLang): { lang: MailLang; mail: GroupMail; fallback: boolean } | null {
  const written = (m: GroupMail | undefined) => Boolean(m?.subject.trim() && m?.message.trim());
  const other: MailLang = lang === 'de' ? 'en' : 'de';
  if (written(group.mail[lang])) return { lang, mail: group.mail[lang], fallback: false };
  if (written(group.mail[other])) return { lang: other, mail: group.mail[other], fallback: true };
  return null;
}

/**
 * What is wrong with a mailing as it stands, group by group – the send button
 * stays off while there is anything. Recipients' languages come from the check
 * (`langsInUse`), so a group nobody fits needs no text yet.
 */
export function problemsOf(source: SourceKey, config: MailingConfig, langsInUse: Record<string, MailLang[]>): string[] {
  const out: string[] = [];
  const known = new Set<string>(SOURCES[source].placeholders);
  if (!config.groups.length) out.push('Add at least one group.');
  if (config.headerImageUrl && !/^https?:\/\/\S+$/i.test(config.headerImageUrl)) {
    out.push('The header image must be an absolute https:// address.');
  }
  for (const g of config.groups) {
    const name = g.label.trim() || 'A group';
    const langs = langsInUse[g.id] ?? [];
    if (!langs.length) continue;
    if (!mailFor(g, langs[0])) out.push(`${name}: write a subject and a text (in at least one language).`);
    const url = g.ctaUrl.trim();
    const placeholderUrl = /^\{\{\s*manageLink\s*\}\}$/.test(url) && known.has('manageLink');
    if (url && !placeholderUrl && !/^https?:\/\/\S+$/i.test(url)) out.push(`${name}: the button link must start with https://.`);
    for (const lang of langs) {
      const used = mailFor(g, lang);
      if (!used) continue;
      for (const [, key] of `${used.mail.subject} ${used.mail.message}`.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
        if (!known.has(key)) out.push(`${name}: {{${key}}} is not filled in for ${SOURCES[source].label.toLowerCase()} – remove it.`);
      }
      if (url && !used.mail.ctaLabel.trim()) out.push(`${name}: the button needs a label (${used.lang.toUpperCase()}).`);
      if (!url && used.mail.ctaLabel.trim()) out.push(`${name}: the button has a label but no link.`);
      if (!url && /\{\{\s*link\s*\}\}/.test(used.mail.message)) out.push(`${name}: the text uses {{link}}, but there is no link.`);
    }
  }
  return [...new Set(out)];
}

/** Ready-made starting points for a new mailing. */
export type Preset = { key: string; label: string; description: string; source: SourceKey; title: string; config: () => MailingConfig };

export const PRESETS: Preset[] = [
  {
    key: 'blank-applications',
    label: 'Applications – blank',
    description: 'To the membership applicants. One group, everyone in it.',
    source: 'applications',
    title: 'New mailing',
    config: emptyConfig,
  },
  {
    key: 'decisions',
    label: 'Application decisions',
    description: 'Speedrun → interview invitation → rejection. Unsure and unreviewed applicants block the send.',
    source: 'applications',
    title: 'Interviews',
    config: (): MailingConfig => ({
      onlyOnce: true,
      requireAll: true,
      headerImageUrl: '',
      groups: [
        {
          ...emptyGroup('Speedrun'),
          filter: { speedrun: 'yes' },
          mail: {
            en: {
              subject: 'Let’s get to know each other',
              message:
                'Hi {{firstName}},\n\nthanks for your speedrun application to Coding for Change! We’d love to get to know you in a short, relaxed call.\n\nPick a time that suits you with the button below. If none of the slots work, just reply to this email.\n\nSee you soon!\nThe Coding for Change team',
              ctaLabel: 'Book a call',
            },
            de: {
              subject: 'Lass uns kennenlernen',
              message:
                'Hallo {{firstName}},\n\ndanke für deine Speedrun-Bewerbung bei Coding for Change! Wir würden dich gern in einem kurzen, entspannten Gespräch kennenlernen.\n\nSuch dir über den Button unten einen Termin aus, der dir passt. Wenn keiner klappt, antworte einfach auf diese Mail.\n\nBis bald!\nDein Coding for Change Team',
              ctaLabel: 'Termin buchen',
            },
          },
        },
        {
          ...emptyGroup('Interview invitation'),
          filter: { status: ['accepted'], speedrun: 'no' },
          mail: {
            en: {
              subject: 'Your interview with Coding for Change',
              message:
                'Hi {{firstName}},\n\nthanks again for your application – we enjoyed reading it, and we’d like to invite you to an interview!\n\nThe interviews take place from 2 to 8 November: a conversation and a small hands-on challenge. Book your slot with the button below.\n\nIf none of the slots work for you, just reply to this email and we’ll find a time.\n\nSee you soon!\nThe Coding for Change team',
              ctaLabel: 'Book your interview',
            },
            de: {
              subject: 'Dein Interview bei Coding for Change',
              message:
                'Hallo {{firstName}},\n\nnoch einmal danke für deine Bewerbung – wir haben sie gern gelesen und möchten dich zum Interview einladen!\n\nDie Interviews finden vom 2. bis 8. November statt: ein Gespräch und eine kleine praktische Challenge. Buch dir über den Button unten deinen Termin.\n\nWenn keiner der Termine passt, antworte einfach auf diese Mail, dann finden wir einen.\n\nBis bald!\nDein Coding for Change Team',
              ctaLabel: 'Interviewtermin buchen',
            },
          },
        },
        {
          ...emptyGroup('Rejection'),
          filter: { status: ['rejected'], speedrun: 'no' },
          mail: {
            en: {
              subject: 'Your application to Coding for Change',
              message:
                'Hi {{firstName}},\n\nthank you for applying to Coding for Change and for the time you put into it.\n\nWe received many strong applications this round and can’t invite everyone – we’re sorry that this time it isn’t you.\n\nPlease don’t let that stop you – we’d be glad to see you apply again next semester.\n\nAll the best,\nThe Coding for Change team',
              ctaLabel: '',
            },
            de: {
              subject: 'Deine Bewerbung bei Coding for Change',
              message:
                'Hallo {{firstName}},\n\ndanke für deine Bewerbung bei Coding for Change und die Zeit, die du dir dafür genommen hast.\n\nWir haben in dieser Runde viele starke Bewerbungen bekommen und können nicht alle einladen – leider bist du diesmal nicht dabei.\n\nLass dich davon bitte nicht abhalten – wir freuen uns, wenn du dich im nächsten Semester wieder bewirbst.\n\nAlles Gute\nDein Coding for Change Team',
              ctaLabel: '',
            },
          },
        },
      ],
    }),
  },
  {
    key: 'blank-waitlist',
    label: 'Waitlist – blank',
    description: 'To everyone on the waitlist, one mail per address.',
    source: 'waitlist',
    title: 'Waitlist mailing',
    config: emptyConfig,
  },
  {
    key: 'blank-techtour',
    label: 'TechTour – blank',
    description: 'To the TechTour registrations, one mail each – {{manageLink}} is the person’s own link.',
    source: 'techtour',
    title: 'TechTour mailing',
    config: emptyConfig,
  },
];

/** Normalise a config read from the database or a request: drop what does not belong. */
export function cleanConfig(raw: unknown, source: SourceKey): MailingConfig {
  const r = (raw ?? {}) as Partial<MailingConfig>;
  const filters = SOURCES[source].filters;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const cleanMail = (m: unknown): GroupMail => {
    const x = (m ?? {}) as Partial<GroupMail>;
    return { subject: str(x.subject, 200), message: str(x.message, 20000), ctaLabel: str(x.ctaLabel, 100) };
  };
  const groups = (Array.isArray(r.groups) ? r.groups : []).slice(0, 20).map((g): MailingGroup => {
    const filter: Record<string, FilterValue> = {};
    for (const def of filters) {
      const v = (g?.filter ?? {})[def.key];
      if (def.kind === 'choice' && Array.isArray(v)) {
        // Options from the data (evening keys) are only known on the server's
        // side of a request; keep any short key, unknown ones simply match nobody.
        filter[def.key] = def.dynamic
          ? v.map(String).filter((x) => x.length <= 100).slice(0, 50)
          : v.map(String).filter((x) => def.options.some((o) => o.value === x));
      } else if (def.kind === 'range' && v && typeof v === 'object' && !Array.isArray(v)) {
        const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : null);
        filter[def.key] = { min: num((v as RangeFilter).min), max: num((v as RangeFilter).max) };
      } else if (def.kind === 'flag' && (v === 'yes' || v === 'no' || v === 'any')) {
        filter[def.key] = v;
      }
    }
    return {
      id: str(g?.id, 40) || newGroupId(),
      label: str(g?.label, 100),
      filter,
      mail: { en: cleanMail(g?.mail?.en), de: cleanMail(g?.mail?.de) },
      ctaUrl: str(g?.ctaUrl, 1000).trim(),
    };
  });
  return {
    groups,
    onlyOnce: r.onlyOnce !== false,
    requireAll: r.requireAll === true,
    headerImageUrl: str(r.headerImageUrl, 1000).trim(),
  };
}
