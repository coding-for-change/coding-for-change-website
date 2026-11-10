import type { Payload, PayloadRequest } from 'payload';
import { poolOf } from '../../endpoints/util';
import { siteOrigin } from '../mediaUpload';
import {
  decodeExternalId,
  docusealBase,
  encodeExternalId,
  isOpen,
  mergeStatus,
  signingUrl,
  statusFromSubmission,
  type DocStatus,
  type WebhookEvent,
} from './docuseal';
import { archiveSubmission, createSubmission, DocusealError, getSubmission } from './docusealClient';
import { notifyIfStepsDone } from './notify';
import { DOCUMENTS_TABLE } from './tables';

/**
 * The onboarding documents a member signs through DocuSeal, on the database
 * side (onboarding_documents, tables.ts): starting one, following DocuSeal's
 * webhook, and reading the state back from DocuSeal when a webhook got lost.
 * Every change of a row is one UPDATE that only moves its status up
 * (docuseal.ts `mergeStatus`), so events arriving twice or out of order, and
 * a webhook racing a resync, cannot undo each other.
 */

type Row = {
  id: number;
  user: number;
  item: string;
  status: string;
  submissionId: number;
  slug: string;
  completedAt: string | null;
};

const rowOf = (r: Record<string, unknown>): Row => ({
  id: Number(r.id),
  user: Number(r.user_id),
  item: String(r.item_id),
  status: String(r.status),
  submissionId: Number(r.docuseal_submission_id),
  slug: String(r.docuseal_submitter_slug),
  completedAt: r.completed_at == null ? null : new Date(r.completed_at as string).toISOString(),
});

const COLUMNS = 'id, user_id, item_id, status, docuseal_submission_id, docuseal_submitter_slug, completed_at';

type Client = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  release: () => void;
};

/**
 * Move a row's status to `incoming` if that is a step up. Atomic: the
 * comparison happens in the UPDATE (only rows still at `from`), so two
 * events at once cannot both win. Returns the status it now has and whether
 * it changed.
 */
async function advance(
  payload: Payload,
  row: Row,
  incoming: DocStatus,
  completedAt: string | null,
): Promise<{ status: DocStatus; changed: boolean }> {
  let current = row;
  for (let attempt = 0; attempt < 3; attempt++) {
    const next = mergeStatus(current.status, incoming);
    if (next === current.status) return { status: next, changed: false };
    const { rows } = await poolOf(payload).query(
      `UPDATE ${DOCUMENTS_TABLE}
       SET status = $2::varchar, updated_at = now(),
           completed_at = CASE WHEN $2::varchar = 'completed' THEN COALESCE(completed_at, $4::timestamptz, now()) ELSE completed_at END
       WHERE id = $1 AND status = $3::varchar
       RETURNING ${COLUMNS}`,
      [current.id, next, current.status, completedAt],
    );
    if (rows.length) return { status: next, changed: true };
    // Someone else changed it in between: read it again and decide again.
    const again = await poolOf(payload).query(`SELECT ${COLUMNS} FROM ${DOCUMENTS_TABLE} WHERE id = $1`, [current.id]);
    if (!again.rows.length) return { status: current.status as DocStatus, changed: false };
    current = rowOf(again.rows[0]);
  }
  return { status: current.status as DocStatus, changed: false };
}

// ---- the webhook ----------------------------------------------------------------

export type WebhookOutcome =
  | { result: 'ignored'; reason: string }
  | { result: 'unchanged' | 'updated'; status: DocStatus };

/**
 * Apply one webhook event. Our row is found by DocuSeal's submission id and
 * by nothing else; a submission we did not start (another use of the same
 * DocuSeal instance) is ignored. The event's external id, when it has one,
 * must agree with the row, or the event is ignored as well.
 */
export async function applyWebhookEvent(req: PayloadRequest, event: WebhookEvent): Promise<WebhookOutcome> {
  const { payload } = req;
  if (!event.status) return { result: 'ignored', reason: `event ${event.type} is not followed` };
  if (!event.submissionId) return { result: 'ignored', reason: 'no submission id' };
  const { rows } = await poolOf(payload).query(
    `SELECT ${COLUMNS} FROM ${DOCUMENTS_TABLE} WHERE docuseal_submission_id = $1`,
    [event.submissionId],
  );
  if (!rows.length) return { result: 'ignored', reason: 'unknown submission' };
  const row = rowOf(rows[0]);
  if (event.externalId !== null) {
    const ext = decodeExternalId(event.externalId);
    if (!ext || ext.user !== row.user || ext.item !== row.item) {
      payload.logger.warn(`[onboarding] DocuSeal event for submission ${row.submissionId} with a foreign external id, ignored`);
      return { result: 'ignored', reason: 'external id does not match' };
    }
  }
  const { status, changed } = await advance(payload, row, event.status, event.completedAt);
  if (changed) {
    payload.logger.info(`[onboarding] document ${row.item} of user ${row.user}: ${row.status} -> ${status} (${event.type})`);
    if (status === 'completed') await notifyIfStepsDone(req, row.user);
  }
  return { result: changed ? 'updated' : 'unchanged', status };
}

// ---- resync ---------------------------------------------------------------------

export type SyncResult = { item: string; status: string; error?: string };

/**
 * Read the state of `user`'s current documents that are not completed from
 * DocuSeal and apply it, like a webhook would. For the board when webhooks
 * got lost, and for the member's page when they come back from signing.
 * A DocuSeal that cannot be reached leaves every row as it is.
 */
export async function syncDocuments(req: PayloadRequest, user: number): Promise<SyncResult[]> {
  const { payload } = req;
  const { rows } = await poolOf(payload).query(
    `SELECT DISTINCT ON (item_id) ${COLUMNS} FROM ${DOCUMENTS_TABLE}
     WHERE user_id = $1 ORDER BY item_id, id DESC`,
    [user],
  );
  const out: SyncResult[] = [];
  let completed = false;
  for (const row of rows.map(rowOf)) {
    if (row.status === 'completed') {
      out.push({ item: row.item, status: row.status });
      continue;
    }
    try {
      const found = statusFromSubmission(await getSubmission(row.submissionId), row.slug);
      if (!found) {
        out.push({ item: row.item, status: row.status, error: 'DocuSeal answered in an unexpected shape' });
        continue;
      }
      const { status, changed } = await advance(payload, row, found.status, found.completedAt);
      if (changed) {
        payload.logger.info(`[onboarding] document ${row.item} of user ${row.user}: ${row.status} -> ${status} (resync)`);
        if (status === 'completed') completed = true;
      }
      out.push({ item: row.item, status });
    } catch (err) {
      const e = err as DocusealError;
      out.push({
        item: row.item,
        status: row.status,
        error:
          e.kind === 'rejected' && e.status === 404
            ? 'The submission is not in DocuSeal (deleted?)'
            : e instanceof DocusealError
              ? e.message
              : 'Reading it failed',
      });
      if (!(err instanceof DocusealError)) payload.logger.error(`[onboarding] resync of user ${user} failed: ${(err as Error)?.message}`);
    }
  }
  if (completed) await notifyIfStepsDone(req, user);
  return out;
}

// ---- starting a document ------------------------------------------------------

export type StartOutcome =
  | { ok: true; url: string; created: boolean }
  | { ok: false; status: number; error: string };

/** Advisory lock namespace for "one start per account and document at a time". */
const LOCK_NAMESPACE = 0x0cfc_d0c5;

/**
 * Start (or reopen) the member's DocuSeal submission for one document of the
 * onboarding settings and give back the signing link.
 *
 * - An open submission (pending / opened) is returned as it is: a second
 *   click or tab never creates a second one. A lock per account and document
 *   (Postgres advisory lock, held for the transaction) makes that hold for
 *   two requests at once too.
 * - A completed document is not started again.
 * - Declined or expired: a new submission and row.
 * - DocuSeal down or refusing: nothing is stored. If DocuSeal created the
 *   submission and we cannot store it, we archive it there again.
 */
export async function startDocument(
  payload: Payload,
  input: {
    user: number;
    item: string;
    title: string;
    templateId: number;
    name: string;
    email: string;
  },
): Promise<StartOutcome> {
  const base = docusealBase();
  if (!base || !process.env.DOCUSEAL_API_KEY?.trim()) return { ok: false, status: 503, error: 'unconfigured' };

  const pool = poolOf(payload) as unknown as { connect?: () => Promise<Client> };
  if (typeof pool.connect !== 'function') throw new Error('no database pool with connect()');
  const client = await pool.connect();
  let created: number | null = null;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [LOCK_NAMESPACE, `${input.user}:${input.item}`]);
    const { rows } = await client.query(
      `SELECT ${COLUMNS} FROM ${DOCUMENTS_TABLE} WHERE user_id = $1 AND item_id = $2 ORDER BY id DESC LIMIT 1`,
      [input.user, input.item],
    );
    const last = rows.length ? rowOf(rows[0]) : null;
    if (last?.status === 'completed') {
      await client.query('ROLLBACK');
      return { ok: false, status: 409, error: 'completed' };
    }
    if (last && isOpen(last.status)) {
      await client.query('ROLLBACK');
      return { ok: true, url: signingUrl(base, last.slug), created: false };
    }

    const sub = await createSubmission({
      templateId: input.templateId,
      name: input.name,
      email: input.email,
      externalId: encodeExternalId(input.user, input.item),
      // After signing, DocuSeal sends the tab back to the member's page.
      completedRedirectUrl: `${siteOrigin()}/onboarding`,
    });
    created = sub.submissionId;
    await client.query(
      `INSERT INTO ${DOCUMENTS_TABLE} (user_id, item_id, title, docuseal_template_id, docuseal_submission_id, docuseal_submitter_slug, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
      [input.user, input.item, input.title.slice(0, 500), input.templateId, sub.submissionId, sub.slug],
    );
    await client.query('COMMIT');
    payload.logger.info(`[onboarding] user ${input.user} started document ${input.item} (DocuSeal submission ${sub.submissionId})`);
    return { ok: true, url: signingUrl(base, sub.slug), created: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    const orphan = created ?? (err instanceof DocusealError ? (err.createdSubmissionId ?? null) : null);
    if (orphan !== null) {
      const undone = await archiveSubmission(orphan);
      payload.logger.warn(`[onboarding] DocuSeal submission ${orphan} not stored; archived again: ${undone}`);
    }
    if (err instanceof DocusealError) {
      payload.logger.error(`[onboarding] starting document ${input.item} for user ${input.user}: ${err.message}`);
      return { ok: false, status: err.kind === 'unreachable' ? 503 : 502, error: err.kind };
    }
    payload.logger.error(`[onboarding] storing document ${input.item} for user ${input.user} failed: ${(err as Error)?.message ?? err}`);
    return { ok: false, status: 500, error: 'failed' };
  } finally {
    client.release();
  }
}
