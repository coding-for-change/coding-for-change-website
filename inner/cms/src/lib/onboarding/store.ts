import type { Payload } from 'payload';
import { poolOf } from '../../endpoints/util';
import { CHECKS_TABLE, DOCUMENTS_TABLE } from './tables';

/**
 * Reading and writing the onboarding tables (tables.ts). Checks are only
 * inserted, never updated: the newest row per account, kind and to-do holds.
 */

export type CheckKind = 'member' | 'board';

export type CurrentCheck = {
  user: number;
  kind: CheckKind;
  item: string;
  done: boolean;
  text: string;
  by: string;
  at: string;
};

export type CurrentDocument = {
  user: number;
  item: string;
  title: string;
  status: string;
  submissionId: number;
  submitterSlug: string;
  startedAt: string;
  completedAt: string | null;
};

const iso = (v: unknown) => new Date(v as string).toISOString();

/** The current state of every to-do with a row, for `users` (all when left out). */
export async function currentChecks(payload: Payload, users?: number[]): Promise<CurrentCheck[]> {
  if (users && users.length === 0) return [];
  const { rows } = await poolOf(payload).query(
    `SELECT DISTINCT ON (user_id, kind, item_id) user_id, kind, item_id, done, text, done_by, created_at
     FROM ${CHECKS_TABLE}
     ${users ? 'WHERE user_id = ANY($1::int[])' : ''}
     ORDER BY user_id, kind, item_id, id DESC`,
    users ? [users] : [],
  );
  return rows.map((r) => ({
    user: Number(r.user_id),
    kind: r.kind as CheckKind,
    item: String(r.item_id),
    done: Boolean(r.done),
    text: String(r.text),
    by: String(r.done_by),
    at: iso(r.created_at),
  }));
}

/** Tick a to-do or take the tick back, with the wording and link shown. */
export async function setCheck(
  payload: Payload,
  check: {
    user: number;
    kind: CheckKind;
    item: string;
    text: string;
    linkUrl?: string | null;
    done: boolean;
    by: string;
    locale?: 'de' | 'en' | null;
  },
): Promise<{ at: string }> {
  const { rows } = await poolOf(payload).query(
    `INSERT INTO ${CHECKS_TABLE} (user_id, kind, item_id, text, link_url, done, done_by, locale)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING created_at`,
    [check.user, check.kind, check.item, check.text, check.linkUrl ?? null, check.done, check.by, check.locale ?? null],
  );
  return { at: iso(rows[0].created_at) };
}

/** The newest DocuSeal submission per account and document, for `users` (all when left out). */
export async function currentDocuments(payload: Payload, users?: number[]): Promise<CurrentDocument[]> {
  if (users && users.length === 0) return [];
  const { rows } = await poolOf(payload).query(
    `SELECT DISTINCT ON (user_id, item_id) user_id, item_id, title, status, docuseal_submission_id,
            docuseal_submitter_slug, created_at, completed_at
     FROM ${DOCUMENTS_TABLE}
     ${users ? 'WHERE user_id = ANY($1::int[])' : ''}
     ORDER BY user_id, item_id, id DESC`,
    users ? [users] : [],
  );
  return rows.map((r) => ({
    user: Number(r.user_id),
    item: String(r.item_id),
    title: String(r.title),
    status: String(r.status),
    submissionId: Number(r.docuseal_submission_id),
    submitterSlug: String(r.docuseal_submitter_slug),
    startedAt: iso(r.created_at),
    completedAt: r.completed_at == null ? null : iso(r.completed_at),
  }));
}
