import { randomBytes } from 'node:crypto';
import type { Payload } from 'payload';
import { poolOf } from '../../endpoints/util';
import { pickedKeys, type OptionRow } from '../choiceKeys';
import { CHANGES_TABLE, TOKENS_TABLE, WITHDRAWALS_TABLE } from './tables';

/**
 * Reading and writing the /techtour/manage tables (lib/manage/tables.ts).
 *
 * Only ever INSERT and SELECT, and only on those tables: a registration
 * (`form_submissions`) is read through Payload as before and never written
 * here. A withdrawal is not a change to the registration – it is a row of its
 * own, and whoever shows a registration's evenings leaves the withdrawn ones
 * out (the host page, lib/share/registrations.ts; the admin count,
 * components/techtour/EveningDistribution.tsx) or marks them as given up (the
 * review workspace, through endpoints/withdrawals.ts – where we can also add
 * one back: a row in the changes table, and the newest row decides).
 */

/**
 * Evenings can be given up until Sunday 1 November 2026, 23:59 in Munich. The
 * first moment after that is 2 November 00:00 CET (UTC+1, summer time ended
 * on 25 October) – 1 November 23:00 UTC. From then on the page only shows.
 */
export const MANAGE_UNTIL = new Date('2026-11-01T23:00:00.000Z');

export const manageOpen = (now: Date = new Date()): boolean => now.getTime() < MANAGE_UNTIL.getTime();

/** What a token looks like: 32 random bytes as base64url. Nothing else reaches a query. */
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

const newToken = (): string => randomBytes(32).toString('base64url');

/**
 * The personal link token of each registration, made the first time it is
 * asked for (the mass mail asks for all of them at once). A registration keeps
 * its token: sending a second mail sends the same link.
 */
export async function tokensFor(payload: Payload, ids: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id)))];
  if (unique.length === 0) return new Map();
  const pool = poolOf(payload);
  await pool.query(
    `INSERT INTO ${TOKENS_TABLE} (submission_id, token)
     SELECT id, token FROM unnest($1::int[], $2::text[]) AS t(id, token)
     ON CONFLICT DO NOTHING`,
    [unique, unique.map(newToken)],
  );
  const { rows } = await pool.query(
    `SELECT submission_id, token FROM ${TOKENS_TABLE} WHERE submission_id = ANY($1::int[])`,
    [unique],
  );
  return new Map(rows.map((r) => [Number(r.submission_id), String(r.token)]));
}

/** The registration a token belongs to, or null. */
export async function registrationOfToken(payload: Payload, token: string): Promise<number | null> {
  if (!TOKEN_RE.test(token)) return null;
  const { rows } = await poolOf(payload).query(
    `SELECT submission_id FROM ${TOKENS_TABLE} WHERE token = $1 LIMIT 1`,
    [token],
  );
  return rows[0] ? Number(rows[0].submission_id) : null;
}

/** Where an evening of a registration stands, by its newest row. */
export type EveningState = { withdrawn: boolean; at: string; by: string };

/**
 * Per registration (of `ids`, or every one), each evening with a withdrawal
 * or a change behind it, by the newest row: the first withdrawal
 * (`techtour_withdrawals`, through the link) or a later change
 * (`techtour_evening_changes`). An evening without a row is as registered.
 */
export async function eveningStates(payload: Payload, ids?: number[]): Promise<Map<number, Map<string, EveningState>>> {
  const out = new Map<number, Map<string, EveningState>>();
  if (ids && ids.length === 0) return out;
  const { rows } = await poolOf(payload).query(
    `SELECT DISTINCT ON (submission_id, option) submission_id, option, withdrawn, changed_by, created_at
     FROM (
       SELECT submission_id, option, true AS withdrawn, 'link' AS changed_by, created_at, 0 AS src, id FROM ${WITHDRAWALS_TABLE}
       UNION ALL
       SELECT submission_id, option, withdrawn, changed_by, created_at, 1 AS src, id FROM ${CHANGES_TABLE}
     ) e
     ${ids ? 'WHERE submission_id = ANY($1::int[])' : ''}
     ORDER BY submission_id, option, created_at DESC, src DESC, id DESC`,
    ids ? [ids] : [],
  );
  for (const r of rows) {
    const id = Number(r.submission_id);
    if (!out.has(id)) out.set(id, new Map());
    out.get(id)!.set(String(r.option), {
      withdrawn: r.withdrawn === true,
      at: new Date(r.created_at as string).toISOString(),
      by: String(r.changed_by),
    });
  }
  return out;
}

/** Per registration (of `ids`, or every one), the evenings withdrawn from now and since when (ISO). */
export async function withdrawalsOf(payload: Payload, ids?: number[]): Promise<Map<number, Map<string, string>>> {
  const out = new Map<number, Map<string, string>>();
  for (const [id, evenings] of await eveningStates(payload, ids)) {
    const gaveUp = [...evenings].filter(([, e]) => e.withdrawn).map(([option, e]) => [option, e.at] as const);
    if (gaveUp.length) out.set(id, new Map(gaveUp));
  }
  return out;
}

/** The registrations among `ids` that are withdrawn from the evening `option` now. */
export async function withdrawnFrom(payload: Payload, option: string, ids: number[]): Promise<Set<number>> {
  const all = await withdrawalsOf(payload, ids);
  return new Set([...all].filter(([, evenings]) => evenings.has(option)).map(([id]) => id));
}

/**
 * Record withdrawals through the link. One already in force keeps its time.
 * The first time an evening is given up it goes into `techtour_withdrawals`;
 * once we added it back, giving it up again is a row in the changes table.
 */
export async function withdraw(payload: Payload, id: number, options: string[]): Promise<void> {
  const current = (await withdrawalsOf(payload, [id])).get(id);
  const wanted = [...new Set(options)].filter((o) => !current?.has(o));
  if (wanted.length === 0) return;
  const pool = poolOf(payload);
  const { rows } = await pool.query(
    `INSERT INTO ${WITHDRAWALS_TABLE} (submission_id, option)
     SELECT $1, option FROM unnest($2::text[]) AS t(option)
     ON CONFLICT (submission_id, option) DO NOTHING
     RETURNING option`,
    [id, wanted],
  );
  const first = new Set(rows.map((r) => String(r.option)));
  const again = wanted.filter((o) => !first.has(o));
  if (again.length) await change(payload, id, again, true, 'link');
}

/** A change after the first withdrawal: added back (false) or given up again (true), by whom. */
export async function change(payload: Payload, id: number, options: string[], withdrawn: boolean, by: string): Promise<void> {
  if (options.length === 0) return;
  await poolOf(payload).query(
    `INSERT INTO ${CHANGES_TABLE} (submission_id, option, withdrawn, changed_by)
     SELECT $1, option, $2, $3 FROM unnest($4::text[]) AS t(option)`,
    [id, withdrawn, by, [...new Set(options)]],
  );
}

type Registration = {
  submissionData?: { field: string; value: unknown }[] | null;
  choiceKeys?: Record<string, unknown> | null;
};

/**
 * The evenings a registration was sent with: the option keys recorded on
 * arrival, or for one older than that, read back from its answer against the
 * labels in both languages (as lib/share/registrations.ts does).
 */
export function eveningsOf(s: Registration, field: string, ...labels: OptionRow[][]): string[] {
  const recorded = s.choiceKeys?.[field];
  if (Array.isArray(recorded)) return recorded.map(String);
  const answer = String((s.submissionData ?? []).find((kv) => kv.field === field)?.value ?? '');
  return [...new Set(labels.flatMap((options) => pickedKeys(answer, options)))];
}
