import { randomBytes } from 'node:crypto';
import type { Payload } from 'payload';
import { poolOf } from '../../endpoints/util';
import { pickedKeys, type OptionRow } from '../choiceKeys';
import { TOKENS_TABLE, WITHDRAWALS_TABLE } from './tables';

/**
 * Reading and writing the /techtour/manage tables (lib/manage/tables.ts).
 *
 * Only ever INSERT and SELECT, and only on those two tables: a registration
 * (`form_submissions`) is read through Payload as before and never written
 * here. A withdrawal is not a change to the registration – it is a row of its
 * own, and whoever shows a registration's evenings leaves the withdrawn ones
 * out (the host page, lib/share/registrations.ts; the admin count,
 * components/techtour/EveningDistribution.tsx).
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

/** Per registration, the evenings withdrawn from and when (ISO). */
export async function withdrawalsOf(payload: Payload, ids: number[]): Promise<Map<number, Map<string, string>>> {
  const out = new Map<number, Map<string, string>>();
  if (ids.length === 0) return out;
  const { rows } = await poolOf(payload).query(
    `SELECT submission_id, option, created_at FROM ${WITHDRAWALS_TABLE} WHERE submission_id = ANY($1::int[])`,
    [ids],
  );
  for (const r of rows) {
    const id = Number(r.submission_id);
    if (!out.has(id)) out.set(id, new Map());
    out.get(id)!.set(String(r.option), new Date(r.created_at as string).toISOString());
  }
  return out;
}

/** The registrations among `ids` that withdrew from the evening `option`. */
export async function withdrawnFrom(payload: Payload, option: string, ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const { rows } = await poolOf(payload).query(
    `SELECT submission_id FROM ${WITHDRAWALS_TABLE} WHERE option = $1 AND submission_id = ANY($2::int[])`,
    [option, ids],
  );
  return new Set(rows.map((r) => Number(r.submission_id)));
}

/** Record withdrawals. One already recorded keeps its first time. */
export async function withdraw(payload: Payload, id: number, options: string[]): Promise<void> {
  if (options.length === 0) return;
  await poolOf(payload).query(
    `INSERT INTO ${WITHDRAWALS_TABLE} (submission_id, option)
     SELECT $1, option FROM unnest($2::text[]) AS t(option)
     ON CONFLICT (submission_id, option) DO NOTHING`,
    [id, [...new Set(options)]],
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
