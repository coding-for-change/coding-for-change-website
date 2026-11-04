import type { Payload, PayloadRequest } from 'payload';
import { pickedKeys } from '../choiceKeys';
import { withdrawnFrom } from '../manage/store';
import { membersAmong } from '../members';
import { consentedToSharing } from '../sharingConsent';
import { eveningOf, eveningsFieldOf, type Evening } from './evening';
import { positionsOf, scoresOf, setPositions } from './store';

/**
 * What a host company sees through its share link, and nothing more: the
 * registrations for its evening whose sender agreed to it, each with the name,
 * the CV and the other answers to the form's own questions (e.g. university).
 * Never the email address, the other evenings a person picked, their ticks,
 * our review, or anything about a membership application (Datenschutz
 * section 5a).
 *
 * "Agreed to it" means the ticked `hostSharing` box in the registration's own
 * record (lib/sharingConsent.ts) – the consent to pass the registration on to
 * the host companies of the evenings picked. A registration without it (sent
 * before the box existed, or posted around the form) is not shown, cannot be
 * decided on, and its CV cannot be opened through the link.
 *
 * Nor is anyone who gave the evening up through their own link
 * (/techtour/manage, lib/manage/store.ts) – unless we added it back in the
 * admin: the registration still carries the evening, the withdrawal is a row
 * of its own, and it is left out here.
 *
 * Whom we marked as a Coding for Change member (lib/members.ts) carries a
 * "Member" badge – the mark, not anything from a membership application.
 *
 * Also records the host's decision on a registration, under the evening's key
 * in the submission's `hostDecisions` – so it is deleted together with the
 * registration. Besides admit and decline, a host can put someone on the
 * waitlist: in the order of the host's 1–10 rating when the evening is rated,
 * otherwise first waitlisted first – and within the same rating as the host
 * moved them (lib/share/store.ts). When an admitted person gives the evening
 * up, the first one moves up (lib/share/moveUp.ts) – recorded as admitted
 * `by: 'waitlist'`.
 */

export type HostDecision = 'admitted' | 'waitlisted' | 'declined';
export type HostDecisions = Record<string, { decision: HostDecision; by: string; at: string }>;

/** `by` of an admission the waitlist made on its own (lib/share/moveUp.ts). */
export const WAITLIST_BY = 'waitlist';

export type ShareLinkDoc = {
  id: number;
  title: string;
  option: string;
  form?: number | { id: number } | null;
  recipients?: { email: string; name?: string | null }[] | null;
  expiresAt?: string | null;
  blocked?: boolean | null;
  token?: string | null;
  /** The page shows the 1–10 rating. */
  rating?: boolean | null;
  /** The page has a waitlist. */
  waitlist?: boolean | null;
  /** With the waitlist on: until then, someone moves up from it on their own when a spot frees up. */
  waitlistUntil?: string | null;
};

export type HostRow = {
  id: number;
  name: string;
  registeredAt: string;
  details: { label: string; value: string }[];
  hasCv: boolean;
  decision: HostDecision | null;
  /** Marked by us as a Coding for Change member. */
  member: boolean;
  /** The host's 1–10 rating for the evening. */
  score: number | null;
  /** Place on the evening's waitlist (1 = next to move up), while on it. */
  waitlist: number | null;
  /** When they moved up from the waitlist on their own, while still admitted that way. */
  movedUpAt: string | null;
};

type Block = {
  blockType: string;
  name?: string;
  label?: string | null;
  options?: { label?: string | null; value: string }[] | null;
};

export type SubmissionDoc = {
  id: number;
  form: number | { id: number };
  createdAt: string;
  submissionData?: { field: string; value: string }[] | null;
  files?: (number | { id: number })[] | null;
  choiceKeys?: Record<string, string[]> | null;
  agreedTo?: { field: string }[] | null;
  hostDecisions?: HostDecisions | null;
  language?: 'en' | 'de' | null;
};

/** Questions whose answers a host may see: the person's own words, not their contact data. */
const SHOWN = new Set(['text', 'textarea', 'select', 'number']);
const PERSONAL = /^(e-?mail|phone|telefon|first\s*name|last\s*name|firstname|lastname|name)$/i;

const formIdOf = (link: ShareLinkDoc) => (typeof link.form === 'object' && link.form ? link.form.id : (link.form as number));

export const isRecipient = (link: ShareLinkDoc, email: string) =>
  (link.recipients ?? []).some((r) => r.email.trim().toLowerCase() === email.trim().toLowerCase());

type Scope = {
  evening: Evening;
  fields: Block[];
  /** The evenings' options in both languages, for registrations older than `choiceKeys`. */
  options: { en: Block['options']; de: Block['options'] };
};

async function scopeOf(payload: Payload, link: ShareLinkDoc, req?: PayloadRequest): Promise<Scope | null> {
  const formId = formIdOf(link);
  if (formId == null) return null;
  const evening = await eveningOf(payload, formId, link.option, req);
  if (!evening) return null;
  // Not with `req`: a local-API call with a `locale` writes it onto the
  // request, so two of them in parallel on one `req` both read the language
  // set last – the host's (English) page came out with the German labels.
  const [en, de] = await Promise.all(
    (['en', 'de'] as const).map((locale) =>
      payload.findByID({ collection: 'forms', id: formId, depth: 0, locale }).catch(() => null),
    ),
  );
  const fields = (en?.fields ?? []) as Block[];
  return {
    evening,
    fields,
    options: {
      en: eveningsFieldOf(fields)?.options ?? [],
      de: eveningsFieldOf((de?.fields ?? []) as Block[])?.options ?? [],
    },
  };
}

const inScope = (scope: Scope, s: SubmissionDoc): boolean => {
  if (!consentedToSharing(s)) return false;
  const recorded = s.choiceKeys?.[scope.evening.field];
  if (Array.isArray(recorded)) return recorded.includes(scope.evening.option);
  const answer = (s.submissionData ?? []).find((kv) => kv.field === scope.evening.field)?.value ?? '';
  return [scope.options.en, scope.options.de].some((opts) => pickedKeys(answer, opts ?? []).includes(scope.evening.option));
};

type Extras = { member?: boolean; score?: number | null; waitlist?: number | null };

const rowOf = (scope: Scope, s: SubmissionDoc, extras: Extras = {}): HostRow => {
  const answers = new Map((s.submissionData ?? []).map((kv) => [kv.field, String(kv.value ?? '')]));
  const details: HostRow['details'] = [];
  for (const block of scope.fields) {
    if (!block.name || !SHOWN.has(block.blockType) || PERSONAL.test(block.name)) continue;
    const value = answers.get(block.name)?.trim();
    if (!value) continue;
    const label = (block.label || block.name).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    const shown = block.blockType === 'select' ? (block.options?.find((o) => o.value === value)?.label ?? value) : value;
    details.push({ label, value: shown });
  }
  const name = [answers.get('firstName'), answers.get('lastName')].filter((x) => x?.trim()).join(' ').trim();
  const decided = s.hostDecisions?.[scope.evening.option];
  return {
    id: s.id,
    name: name || `Registration ${s.id}`,
    registeredAt: s.createdAt,
    details,
    hasCv: (s.files ?? []).length > 0,
    decision: decided?.decision ?? null,
    member: extras.member ?? false,
    score: extras.score ?? null,
    waitlist: extras.waitlist ?? null,
    movedUpAt: decided?.decision === 'admitted' && decided.by === WAITLIST_BY ? decided.at : null,
  };
};

async function registrationsOf(
  payload: Payload,
  link: ShareLinkDoc,
  req?: PayloadRequest,
): Promise<{ scope: Scope; docs: SubmissionDoc[] } | null> {
  const scope = await scopeOf(payload, link, req);
  if (!scope) return null;
  const { docs } = await payload.find({
    collection: 'form-submissions',
    where: { form: { equals: formIdOf(link) } },
    depth: 0,
    pagination: false,
    sort: 'createdAt',
    overrideAccess: true,
    req,
  });
  const shown = (docs as unknown as SubmissionDoc[]).filter((s) => inScope(scope, s));
  const withdrawn = await withdrawnFrom(payload, scope.evening.option, shown.map((s) => s.id));
  return { scope, docs: shown.filter((s) => !withdrawn.has(s.id)) };
}

/**
 * What the share links of one evening say together – usually there is one.
 * `rating`: some link shows the 1–10 scale, so the waitlist goes by it.
 * `moveUpUntil`: the latest "Move up from the waitlist until" of a link with
 * the waitlist on (null: off). Blocked links count for nothing.
 */
export async function eveningSettings(
  payload: Payload,
  option: string,
  req?: PayloadRequest,
): Promise<{ links: ShareLinkDoc[]; rating: boolean; moveUpUntil: Date | null }> {
  const { docs } = await payload.find({
    collection: 'share-links',
    where: { option: { equals: option } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  });
  const links = (docs as unknown as ShareLinkDoc[]).filter((l) => !l.blocked);
  const until = links
    .filter((l) => l.waitlist === true)
    .map((l) => (l.waitlistUntil ? new Date(l.waitlistUntil).getTime() : NaN))
    .filter(Number.isFinite);
  return {
    links,
    rating: links.some((l) => l.rating === true),
    moveUpUntil: until.length ? new Date(Math.max(...until)) : null,
  };
}

type Waiting = { id: number; position: number };

/**
 * The evening's waitlist, next to move up first: by the host's rating when the
 * evening is rated (unrated last), then by position – where the host moved
 * them since they were put on it, or else the moment they were – then first
 * registered first.
 */
async function waitlistIn(
  payload: Payload,
  option: string,
  docs: SubmissionDoc[],
  scores: Map<number, number>,
  rated: boolean,
): Promise<Waiting[]> {
  const waiting = docs.filter((s) => s.hostDecisions?.[option]?.decision === 'waitlisted');
  const moved = await positionsOf(payload, option, waiting.map((s) => s.id));
  const registered = new Map(docs.map((s) => [s.id, Date.parse(s.createdAt)]));
  const score = (id: number) => (rated ? (scores.get(id) ?? 0) : 0);
  return waiting
    .map((s) => {
      const since = s.hostDecisions![option].at;
      const m = moved.get(s.id);
      // A move from before they were (last) put on the waitlist no longer counts.
      return { id: s.id, position: m && m.at >= since ? m.position : Date.parse(since) || 0 };
    })
    .sort(
      (a, b) =>
        score(b.id) - score(a.id) ||
        a.position - b.position ||
        (registered.get(a.id) ?? 0) - (registered.get(b.id) ?? 0) ||
        a.id - b.id,
    );
}

/** The registrations of the link's evening, their ratings and its waitlist in order. */
async function standingOf(payload: Payload, link: ShareLinkDoc, req?: PayloadRequest) {
  const found = await registrationsOf(payload, link, req);
  if (!found) return null;
  const option = found.scope.evening.option;
  const [settings, scores] = await Promise.all([
    eveningSettings(payload, option, req),
    scoresOf(payload, option, found.docs.map((s) => s.id)),
  ]);
  const waitlist = await waitlistIn(payload, option, found.docs, scores, settings.rating);
  return { ...found, settings, scores, waitlist };
}

/** Everyone registered for the link's evening, first come first. */
export async function hostView(
  payload: Payload,
  link: ShareLinkDoc,
  req?: PayloadRequest,
): Promise<{ evening: Evening; rows: HostRow[]; moveUpUntil: Date | null } | null> {
  const found = await standingOf(payload, link, req);
  if (!found) return null;
  const members = await membersAmong(payload, found.docs.map((s) => s.id));
  const place = new Map(found.waitlist.map((w, i) => [w.id, i + 1]));
  return {
    evening: found.scope.evening,
    rows: found.docs.map((s) =>
      rowOf(found.scope, s, { member: members.has(s.id), score: found.scores.get(s.id) ?? null, waitlist: place.get(s.id) ?? null }),
    ),
    moveUpUntil: found.settings.moveUpUntil,
  };
}

/** After a change on the page: each person's decision and rating, and the waitlist in order. */
export async function hostState(
  payload: Payload,
  link: ShareLinkDoc,
  req?: PayloadRequest,
): Promise<{ rows: Pick<HostRow, 'id' | 'decision' | 'score' | 'waitlist' | 'movedUpAt'>[] } | null> {
  const view = await hostView(payload, link, req);
  return view && { rows: view.rows.map(({ id, decision, score, waitlist, movedUpAt }) => ({ id, decision, score, waitlist, movedUpAt })) };
}

/**
 * Move someone one place up or down the evening's waitlist. With the evening
 * rated, only past someone with the same rating – the rating comes first.
 * Writes the new order as positions 1, 2, 3 … for whoever's place changed,
 * so someone put on the waitlist later still comes after them.
 */
export async function moveOnWaitlist(
  payload: Payload,
  link: ShareLinkDoc,
  id: number,
  direction: 'up' | 'down',
  by: string,
  req?: PayloadRequest,
): Promise<'ok' | 'not-waitlisted' | 'edge' | 'rating'> {
  const found = await standingOf(payload, link, req);
  if (!found) return 'not-waitlisted';
  const order = [...found.waitlist];
  const i = order.findIndex((w) => w.id === id);
  if (i === -1) return 'not-waitlisted';
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= order.length) return 'edge';
  if (found.settings.rating && (found.scores.get(order[i].id) ?? 0) !== (found.scores.get(order[j].id) ?? 0)) {
    return 'rating';
  }
  [order[i], order[j]] = [order[j], order[i]];
  const moves = order.map((w, k) => ({ id: w.id, position: k + 1 })).filter((m, k) => order[k].position !== m.position);
  await setPositions(payload, found.scope.evening.option, moves, by);
  return 'ok';
}

/** The next to move up from the link's evening's waitlist, or null when it is empty. */
export async function nextOnWaitlist(payload: Payload, link: ShareLinkDoc): Promise<SubmissionDoc | null> {
  const found = await standingOf(payload, link);
  const first = found?.waitlist[0];
  return (first && found.docs.find((s) => s.id === first.id)) || null;
}

/** Every CV on the link's list at once (the page's "Download CVs"), numbered as on the page. */
export async function hostCvs(
  payload: Payload,
  link: ShareLinkDoc,
  req?: PayloadRequest,
): Promise<{ n: number; row: HostRow; file: number }[] | null> {
  const found = await registrationsOf(payload, link, req);
  return (
    found &&
    found.docs.flatMap((s, i) => {
      const file = cvOf(s);
      return file == null ? [] : [{ n: i + 1, row: rowOf(found.scope, s), file }];
    })
  );
}

/** A registration the link may act on, or null when it is not one of its evening's. */
export async function registrationInScope(
  payload: Payload,
  link: ShareLinkDoc,
  id: number,
  req?: PayloadRequest,
): Promise<{ scope: Scope; doc: SubmissionDoc } | null> {
  const scope = await scopeOf(payload, link, req);
  if (!scope || !Number.isInteger(id)) return null;
  const doc = (await payload
    .findByID({ collection: 'form-submissions', id, depth: 0, overrideAccess: true, req })
    .catch(() => null)) as SubmissionDoc | null;
  if (!doc) return null;
  const docForm = typeof doc.form === 'object' && doc.form ? doc.form.id : doc.form;
  if (docForm !== formIdOf(link) || !inScope(scope, doc)) return null;
  const withdrawn = await withdrawnFrom(payload, scope.evening.option, [doc.id]);
  return withdrawn.has(doc.id) ? null : { scope, doc };
}

/** Record (or with null, take back) the host's decision on one registration. */
export async function decide(
  payload: Payload,
  link: ShareLinkDoc,
  id: number,
  decision: HostDecision | null,
  by: string,
  req?: PayloadRequest,
): Promise<boolean> {
  const found = await registrationInScope(payload, link, id, req);
  if (!found) return false;
  const next: HostDecisions = { ...(found.doc.hostDecisions ?? {}) };
  if (decision) next[found.scope.evening.option] = { decision, by, at: new Date().toISOString() };
  else delete next[found.scope.evening.option];
  await payload.update({
    collection: 'form-submissions',
    id,
    data: { hostDecisions: next },
    overrideAccess: true,
    req,
  });
  return true;
}

/** The first file of a registration (its CV), for the link's CV route. */
export const cvOf = (doc: SubmissionDoc): number | null => {
  const first = (doc.files ?? [])[0];
  return first == null ? null : typeof first === 'object' ? first.id : first;
};
