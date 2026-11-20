import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * The pure part of the DocuSeal connection (work package 4): how our
 * document statuses follow DocuSeal's events and submissions, the external
 * id we give a submitter, and the webhook's secret check. No I/O, so all of
 * it is tested (docuseal.test.ts). The HTTP client is docusealClient.ts, the
 * database side documents.ts.
 *
 * What it relies on, from DocuSeal's API reference (docuseal.com/docs/api):
 * - Webhook events: form.viewed, form.started, form.completed, form.declined
 *   (data = the submitter, with data.submission.id) and submission.created,
 *   submission.completed, submission.expired, submission.archived (data =
 *   the submission, data.id). Template events exist too and are ignored.
 * - GET /submissions/{id}: `status`, `expire_at`, `archived_at` and
 *   `submitters[]` with `slug`, `status`, `opened_at`, `completed_at`,
 *   `declined_at`.
 * - A webhook can carry a secret key/value pair in its request headers
 *   (Webhooks, Security, Secret in DocuSeal).
 */

/** Our statuses, as stored in onboarding_documents.status (tables.ts). */
export type DocStatus = 'pending' | 'opened' | 'completed' | 'declined' | 'expired';

/** The header DocuSeal must send, with DOCUSEAL_WEBHOOK_SECRET as its value. */
export const WEBHOOK_SECRET_HEADER = 'x-webhook-secret';

/** Shorter secrets count as unset: the webhook then refuses everything. */
export const MIN_SECRET_LENGTH = 24;

/** A submission the member can still sign: starting it again opens the same one. */
export const isOpen = (status: string): boolean => status === 'pending' || status === 'opened';

/**
 * How far a document has got. A status only ever moves up, so an event that
 * arrives late or twice changes nothing: "opened" after "completed" is
 * ignored. Completed is final. Declined and expired are both an end the
 * member can start again from (a new submission); between the two the first
 * one stays.
 */
const RANK: Record<DocStatus, number> = { pending: 0, opened: 1, declined: 2, expired: 2, completed: 3 };

const isStatus = (s: unknown): s is DocStatus => typeof s === 'string' && s in RANK;

/** The status after `incoming`, given the stored `current`. */
export function mergeStatus(current: string, incoming: DocStatus): DocStatus {
  if (!isStatus(current)) return incoming;
  return RANK[incoming] > RANK[current] ? incoming : current;
}

// ---- webhook events -----------------------------------------------------------

const EVENT_STATUS: Record<string, DocStatus> = {
  'form.viewed': 'opened',
  'form.started': 'opened',
  // We create one submitter per submission: their signature completes it.
  'form.completed': 'completed',
  'form.declined': 'declined',
  'submission.created': 'pending',
  'submission.completed': 'completed',
  'submission.expired': 'expired',
  // An archived submission can no longer be signed: like expired, the member
  // can start the document again. A completed one stays completed (mergeStatus).
  'submission.archived': 'expired',
};

export type WebhookEvent = {
  /** The event type, e.g. "form.completed". */
  type: string;
  /** The status it means; null for events we do not follow (templates). */
  status: DocStatus | null;
  /** DocuSeal's submission id: the only thing used to find our row. */
  submissionId: number | null;
  /** The submitter's external id when the event carries one; only cross-checked, never trusted. */
  externalId: string | null;
  /** When it was completed, for completed events (DocuSeal's time, else the event's). */
  completedAt: string | null;
};

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const posInt = (v: unknown): number | null => {
  const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null;
};

const isoOf = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

/** Read a webhook body. Null when it is not a DocuSeal event at all. */
export function parseWebhookEvent(body: unknown): WebhookEvent | null {
  const b = obj(body);
  const type = typeof b?.event_type === 'string' ? b.event_type : null;
  const data = obj(b?.data);
  if (!b || !type || !data) return null;
  const status = EVENT_STATUS[type] ?? null;
  let submissionId: number | null = null;
  let externalId: string | null = null;
  if (type.startsWith('form.')) {
    submissionId = posInt(obj(data.submission)?.id) ?? posInt(data.submission_id);
    externalId = typeof data.external_id === 'string' ? data.external_id : null;
  } else if (type.startsWith('submission.')) {
    submissionId = posInt(data.id);
  }
  const completedAt = status === 'completed' ? (isoOf(data.completed_at) ?? isoOf(b.timestamp)) : null;
  return { type, status, submissionId, externalId, completedAt };
}

// ---- a submission fetched from the API (resync) ----------------------------------

type ApiSubmitter = {
  slug?: unknown;
  status?: unknown;
  opened_at?: unknown;
  completed_at?: unknown;
  declined_at?: unknown;
};

/**
 * Our status from GET /submissions/{id}, for the member's submitter (found
 * by the slug we stored; the only submitter otherwise). Null when the
 * answer does not have the shape the documentation gives.
 */
export function statusFromSubmission(
  submission: unknown,
  slug: string,
  now: Date = new Date(),
): { status: DocStatus; completedAt: string | null } | null {
  const s = obj(submission);
  const list = Array.isArray(s?.submitters) ? (s!.submitters as unknown[]).map(obj).filter(Boolean) : null;
  if (!s || !list) return null;
  const mine = (list.find((x) => x!.slug === slug) ?? (list.length === 1 ? list[0] : null)) as ApiSubmitter | null;
  if (!mine) return null;
  if (mine.status === 'completed' || isoOf(mine.completed_at)) {
    return { status: 'completed', completedAt: isoOf(mine.completed_at) ?? isoOf(s.completed_at) };
  }
  if (mine.status === 'declined' || isoOf(mine.declined_at) || s.status === 'declined') {
    return { status: 'declined', completedAt: null };
  }
  const expireAt = isoOf(s.expire_at);
  if (s.status === 'expired' || isoOf(s.archived_at) || (expireAt && Date.parse(expireAt) <= now.getTime())) {
    return { status: 'expired', completedAt: null };
  }
  if (mine.status === 'opened' || isoOf(mine.opened_at)) return { status: 'opened', completedAt: null };
  return { status: 'pending', completedAt: null };
}

// ---- the external id ------------------------------------------------------------

const EXTERNAL_PREFIX = 'cfc-onboarding';
/** A row id of the onboarding global's documents array (Payload makes 24 hex characters). */
const ITEM_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The submitter's external id: which account and which document of the
 * onboarding settings a submission is for, readable in DocuSeal. Our own
 * row is always found by the submission id; this is a label and a
 * cross-check, never a key.
 */
export function encodeExternalId(user: number, item: string): string {
  if (!Number.isSafeInteger(user) || user <= 0) throw new Error('external id: bad user id');
  if (!ITEM_RE.test(item)) throw new Error('external id: bad item id');
  return `${EXTERNAL_PREFIX}:${user}:${item}`;
}

export function decodeExternalId(value: unknown): { user: number; item: string } | null {
  if (typeof value !== 'string') return null;
  const m = /^cfc-onboarding:([1-9]\d{0,15}):([A-Za-z0-9_-]{1,64})$/.exec(value);
  if (!m) return null;
  const user = Number(m[1]);
  return Number.isSafeInteger(user) ? { user, item: m[2] } : null;
}

// ---- the webhook secret ---------------------------------------------------------

/** The configured secret, or null when it is unset or too short to count. */
export function webhookSecret(raw = process.env.DOCUSEAL_WEBHOOK_SECRET): string | null {
  const s = raw?.trim() ?? '';
  return s.length >= MIN_SECRET_LENGTH ? s : null;
}

/**
 * Whether the header's value is the secret, in constant time: both sides are
 * hashed first, so neither their content nor their length shows in the time
 * taken. False for everything when no secret is configured.
 */
export function secretMatches(expected: string | null, got: string | null | undefined): boolean {
  if (!expected || typeof got !== 'string' || got.length === 0) return false;
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(got).digest();
  return timingSafeEqual(a, b);
}

// ---- addresses -----------------------------------------------------------------

/** DOCUSEAL_URL without a trailing slash; null when unset or not http(s). */
export function docusealBase(raw = process.env.DOCUSEAL_URL): string | null {
  const s = raw?.trim().replace(/\/+$/, '') ?? '';
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? s : null;
  } catch {
    return null;
  }
}

const SLUG_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** The member's signing page: <DOCUSEAL_URL>/s/<slug> (the API's `embed_src`). */
export function signingUrl(base: string, slug: string): string {
  if (!SLUG_RE.test(slug)) throw new Error('docuseal: bad submitter slug');
  return `${base}/s/${slug}`;
}
