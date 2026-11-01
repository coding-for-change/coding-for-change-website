import type { Payload } from 'payload';
import { poolOf } from '../../endpoints/util';
import { cleanConfig, isSourceKey, type MailingConfig, type SourceKey } from './model';
import type { PreviousMail } from './resolve';
import { MAILINGS_TABLE, RECIPIENTS_TABLE, SENDS_TABLE } from './tables';

/**
 * Reading and writing the mailing tables (lib/mailing/tables.ts) with plain
 * SQL. Only these three tables are written to – never an application or a
 * signup.
 */

export type MailingRow = {
  id: number;
  title: string;
  source: SourceKey;
  config: MailingConfig;
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
};

export type MailingListItem = Pick<MailingRow, 'id' | 'title' | 'source' | 'createdBy' | 'createdAt' | 'updatedAt'> & {
  sends: number;
  sent: number;
  failed: number;
  lastSentAt: string | null;
};

export type SendRow = {
  id: number;
  sentBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  requested: number;
  sent: number;
  failed: number;
};

export type RecipientRow = {
  id: number;
  sendId: number;
  email: string;
  name: string | null;
  groupId: string;
  groupLabel: string;
  lang: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed';
  error: string | null;
  createdAt: string;
  sentAt: string | null;
};

/** A mail as the review workspace lists it under a person. */
export type PersonMail = {
  id: number;
  email: string;
  mailingId: number;
  mailingTitle: string;
  groupLabel: string;
  status: RecipientRow['status'];
  at: string;
};

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));
const isoOrNull = (v: unknown): string | null => (v == null ? null : iso(v));

const toMailing = (r: Record<string, unknown>): MailingRow | null => {
  if (!isSourceKey(r.source)) return null;
  return {
    id: Number(r.id),
    title: String(r.title),
    source: r.source,
    config: cleanConfig(r.config, r.source),
    createdBy: (r.created_by as string | null) ?? null,
    createdAt: iso(r.created_at),
    updatedBy: (r.updated_by as string | null) ?? null,
    updatedAt: iso(r.updated_at),
  };
};

export async function listMailings(payload: Payload): Promise<MailingListItem[]> {
  const { rows } = await poolOf(payload).query(
    `SELECT m.id, m.title, m.source, m.created_by, m.created_at, m.updated_at,
            count(s.id)::int AS sends,
            coalesce(sum(s.sent), 0)::int AS sent,
            coalesce(sum(s.failed), 0)::int AS failed,
            max(s.started_at) AS last_sent_at
     FROM ${MAILINGS_TABLE} m
     LEFT JOIN ${SENDS_TABLE} s ON s.mailing_id = m.id
     GROUP BY m.id
     ORDER BY m.updated_at DESC`,
  );
  return rows.flatMap((r) =>
    isSourceKey(r.source)
      ? [
          {
            id: Number(r.id),
            title: String(r.title),
            source: r.source,
            createdBy: (r.created_by as string | null) ?? null,
            createdAt: iso(r.created_at),
            updatedAt: iso(r.updated_at),
            sends: Number(r.sends),
            sent: Number(r.sent),
            failed: Number(r.failed),
            lastSentAt: isoOrNull(r.last_sent_at),
          },
        ]
      : [],
  );
}

export async function getMailing(payload: Payload, id: number): Promise<MailingRow | null> {
  const { rows } = await poolOf(payload).query(`SELECT * FROM ${MAILINGS_TABLE} WHERE id = $1`, [id]);
  return rows[0] ? toMailing(rows[0]) : null;
}

export async function createMailing(
  payload: Payload,
  input: { title: string; source: SourceKey; config: MailingConfig; by: string | null },
): Promise<number> {
  const { rows } = await poolOf(payload).query(
    `INSERT INTO ${MAILINGS_TABLE} (title, source, config, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $4) RETURNING id`,
    [input.title, input.source, JSON.stringify(input.config), input.by],
  );
  return Number(rows[0].id);
}

export async function updateMailing(
  payload: Payload,
  id: number,
  input: { title: string; config: MailingConfig; by: string | null },
): Promise<void> {
  await poolOf(payload).query(
    `UPDATE ${MAILINGS_TABLE} SET title = $2, config = $3, updated_by = $4, updated_at = now() WHERE id = $1`,
    [id, input.title, JSON.stringify(input.config), input.by],
  );
}

/** Only a mailing that never went out can be deleted – a sent one is history. */
export async function deleteDraft(payload: Payload, id: number): Promise<'deleted' | 'sent' | 'missing'> {
  const { rows } = await poolOf(payload).query(
    `DELETE FROM ${MAILINGS_TABLE} m
     WHERE m.id = $1 AND NOT EXISTS (SELECT 1 FROM ${SENDS_TABLE} s WHERE s.mailing_id = m.id)
     RETURNING id`,
    [id],
  );
  if (rows.length) return 'deleted';
  return (await getMailing(payload, id)) ? 'sent' : 'missing';
}

export async function sendsOf(payload: Payload, mailingId: number): Promise<SendRow[]> {
  const { rows } = await poolOf(payload).query(
    `SELECT id, sent_by, started_at, finished_at, requested, sent, failed
     FROM ${SENDS_TABLE} WHERE mailing_id = $1 ORDER BY id DESC`,
    [mailingId],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    sentBy: (r.sent_by as string | null) ?? null,
    startedAt: iso(r.started_at),
    finishedAt: isoOrNull(r.finished_at),
    requested: Number(r.requested),
    sent: Number(r.sent),
    failed: Number(r.failed),
  }));
}

export async function recipientsOf(payload: Payload, mailingId: number): Promise<RecipientRow[]> {
  const { rows } = await poolOf(payload).query(
    `SELECT id, send_id, email, name, group_id, group_label, lang, subject, status, error, created_at, sent_at
     FROM ${RECIPIENTS_TABLE} WHERE mailing_id = $1 ORDER BY id DESC`,
    [mailingId],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    sendId: Number(r.send_id),
    email: String(r.email),
    name: (r.name as string | null) ?? null,
    groupId: String(r.group_id),
    groupLabel: String(r.group_label),
    lang: String(r.lang),
    subject: String(r.subject),
    status: r.status as RecipientRow['status'],
    error: (r.error as string | null) ?? null,
    createdAt: iso(r.created_at),
    sentAt: isoOrNull(r.sent_at),
  }));
}

/** The stored mail itself, to show what exactly someone got. */
export async function storedMail(
  payload: Payload,
  id: number,
): Promise<{ subject: string; html: string; text: string } | null> {
  const { rows } = await poolOf(payload).query(`SELECT subject, html, text FROM ${RECIPIENTS_TABLE} WHERE id = $1`, [id]);
  return rows[0] ? { subject: String(rows[0].subject), html: String(rows[0].html), text: String(rows[0].text) } : null;
}

/**
 * The addresses a mailing has already reached, with the group and time of that
 * mail. A mail still `pending` counts: it may well have gone out, and sending
 * it again is worse than a gap the history shows. Failed ones do not count.
 */
export async function previousMails(payload: Payload, mailingId: number): Promise<Map<string, PreviousMail>> {
  const { rows } = await poolOf(payload).query(
    `SELECT DISTINCT ON (email) email, group_label, created_at
     FROM ${RECIPIENTS_TABLE}
     WHERE mailing_id = $1 AND status IN ('sent', 'pending')
     ORDER BY email, id`,
    [mailingId],
  );
  return new Map(rows.map((r) => [String(r.email), { groupLabel: String(r.group_label), at: iso(r.created_at) }]));
}

/** Every mail of every mailing, newest first, for the people in the review workspace. */
export async function allPersonMails(payload: Payload): Promise<PersonMail[]> {
  const { rows } = await poolOf(payload).query(
    `SELECT r.id, r.email, r.mailing_id, m.title, r.group_label, r.status, r.created_at
     FROM ${RECIPIENTS_TABLE} r JOIN ${MAILINGS_TABLE} m ON m.id = r.mailing_id
     ORDER BY r.id DESC`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    email: String(r.email),
    mailingId: Number(r.mailing_id),
    mailingTitle: String(r.title),
    groupLabel: String(r.group_label),
    status: r.status as PersonMail['status'],
    at: iso(r.created_at),
  }));
}

// ---- sending ------------------------------------------------------------------

/**
 * Take the mailing's send lock. False when a send is already running – or ran
 * within the last 15 minutes without finishing (a crashed send frees the lock
 * after that, never sooner).
 */
export async function lockForSending(payload: Payload, id: number): Promise<boolean> {
  const { rows } = await poolOf(payload).query(
    `UPDATE ${MAILINGS_TABLE} SET sending_since = now()
     WHERE id = $1 AND (sending_since IS NULL OR sending_since < now() - interval '15 minutes')
     RETURNING id`,
    [id],
  );
  return rows.length > 0;
}

export async function unlock(payload: Payload, id: number): Promise<void> {
  await poolOf(payload).query(`UPDATE ${MAILINGS_TABLE} SET sending_since = NULL WHERE id = $1`, [id]);
}

export async function startSend(
  payload: Payload,
  input: { mailingId: number; by: string | null; requested: number; config: MailingConfig },
): Promise<number> {
  const { rows } = await poolOf(payload).query(
    `INSERT INTO ${SENDS_TABLE} (mailing_id, sent_by, requested, config) VALUES ($1, $2, $3, $4) RETURNING id`,
    [input.mailingId, input.by, input.requested, JSON.stringify(input.config)],
  );
  return Number(rows[0].id);
}

export type PendingMail = {
  submission?: number;
  waitlistSignup?: number;
  email: string;
  name: string;
  groupId: string;
  groupLabel: string;
  lang: string;
  subject: string;
  html: string;
  text: string;
};

/** Store the mails as `pending` before they are handed over; ids in the same order. */
export async function storePending(
  payload: Payload,
  mailingId: number,
  sendId: number,
  mails: PendingMail[],
): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < mails.length; i += 100) {
    const chunk = mails.slice(i, i + 100);
    const { rows } = await poolOf(payload).query(
      `INSERT INTO ${RECIPIENTS_TABLE}
         (mailing_id, send_id, submission_id, waitlist_signup_id, email, name, group_id, group_label, lang, subject, html, text, status)
       SELECT $1, $2, x.submission_id, x.waitlist_signup_id, x.email, x.name, x.group_id, x.group_label, x.lang, x.subject, x.html, x.text, 'pending'
       FROM unnest($3::int[], $4::int[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::text[], $11::text[], $12::text[], $13::int[])
         AS x(submission_id, waitlist_signup_id, email, name, group_id, group_label, lang, subject, html, text, ord)
       ORDER BY x.ord
       RETURNING id`,
      [
        mailingId,
        sendId,
        chunk.map((m) => m.submission ?? null),
        chunk.map((m) => m.waitlistSignup ?? null),
        chunk.map((m) => m.email),
        chunk.map((m) => m.name),
        chunk.map((m) => m.groupId),
        chunk.map((m) => m.groupLabel),
        chunk.map((m) => m.lang),
        chunk.map((m) => m.subject),
        chunk.map((m) => m.html),
        chunk.map((m) => m.text),
        chunk.map((_, k) => k),
      ],
    );
    ids.push(...rows.map((r) => Number(r.id)).sort((a, b) => a - b));
  }
  return ids;
}

/** Record the provider's answer for each stored mail. */
export async function recordResults(
  payload: Payload,
  results: { id: number; providerId?: string | null; error?: string | null }[],
): Promise<void> {
  for (let i = 0; i < results.length; i += 500) {
    const chunk = results.slice(i, i + 500);
    await poolOf(payload).query(
      `UPDATE ${RECIPIENTS_TABLE} AS r
       SET status = CASE WHEN v.error IS NULL THEN 'sent' ELSE 'failed' END,
           provider_id = v.provider_id,
           error = v.error,
           sent_at = CASE WHEN v.error IS NULL THEN now() ELSE NULL END
       FROM unnest($1::int[], $2::text[], $3::text[]) AS v(id, provider_id, error)
       WHERE r.id = v.id`,
      [chunk.map((r) => r.id), chunk.map((r) => r.providerId ?? null), chunk.map((r) => r.error ?? null)],
    );
  }
}

export async function finishSend(payload: Payload, sendId: number, sent: number, failed: number): Promise<void> {
  await poolOf(payload).query(
    `UPDATE ${SENDS_TABLE} SET sent = $2, failed = $3, finished_at = now() WHERE id = $1`,
    [sendId, sent, failed],
  );
}
