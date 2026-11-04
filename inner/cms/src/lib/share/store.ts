import type { Payload } from 'payload';
import { poolOf } from '../../endpoints/util';
import { MOVES_TABLE, ORDER_TABLE, SCORES_TABLE } from './tables';

/**
 * Reading and writing the host tables (lib/share/tables.ts) with plain SQL.
 * Only ever INSERT and SELECT, and only on those tables – the newest row of a
 * person and evening stands.
 */

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

export const isScore = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= SCORE_MIN && v <= SCORE_MAX;

/** Per registration (of `ids`), the host's current rating for the evening. */
export async function scoresOf(payload: Payload, option: string, ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const { rows } = await poolOf(payload).query(
    `SELECT DISTINCT ON (submission_id) submission_id, score
     FROM ${SCORES_TABLE}
     WHERE option = $1 AND submission_id = ANY($2::int[])
     ORDER BY submission_id, created_at DESC, id DESC`,
    [option, ids],
  );
  return new Map(rows.filter((r) => r.score != null).map((r) => [Number(r.submission_id), Number(r.score)]));
}

/** Per registration (of `ids`, or every one), each evening's current rating – for the review workspace. */
export async function allScores(payload: Payload, ids?: number[]): Promise<Map<number, Map<string, number>>> {
  const out = new Map<number, Map<string, number>>();
  if (ids && ids.length === 0) return out;
  const { rows } = await poolOf(payload).query(
    `SELECT DISTINCT ON (submission_id, option) submission_id, option, score
     FROM ${SCORES_TABLE}
     ${ids ? 'WHERE submission_id = ANY($1::int[])' : ''}
     ORDER BY submission_id, option, created_at DESC, id DESC`,
    ids ? [ids] : [],
  );
  for (const r of rows) {
    if (r.score == null) continue;
    const id = Number(r.submission_id);
    if (!out.has(id)) out.set(id, new Map());
    out.get(id)!.set(String(r.option), Number(r.score));
  }
  return out;
}

export async function setScore(
  payload: Payload,
  option: string,
  ids: number[],
  score: number | null,
  by: string,
): Promise<void> {
  if (ids.length === 0) return;
  await poolOf(payload).query(
    `INSERT INTO ${SCORES_TABLE} (submission_id, option, score, scored_by)
     SELECT id, $2, $3, $4 FROM unnest($1::int[]) AS t(id)`,
    [ids, option, score, by],
  );
}

/** Per registration (of `ids`), the newest position the host moved them to on the evening's waitlist, and when. */
export async function positionsOf(
  payload: Payload,
  option: string,
  ids: number[],
): Promise<Map<number, { position: number; at: string }>> {
  if (ids.length === 0) return new Map();
  const { rows } = await poolOf(payload).query(
    `SELECT DISTINCT ON (submission_id) submission_id, position, created_at
     FROM ${ORDER_TABLE}
     WHERE option = $1 AND submission_id = ANY($2::int[])
     ORDER BY submission_id, created_at DESC, id DESC`,
    [option, ids],
  );
  return new Map(
    rows.map((r) => [
      Number(r.submission_id),
      { position: Number(r.position), at: new Date(r.created_at as string).toISOString() },
    ]),
  );
}

export async function setPositions(
  payload: Payload,
  option: string,
  moves: { id: number; position: number }[],
  by: string,
): Promise<void> {
  if (moves.length === 0) return;
  await poolOf(payload).query(
    `INSERT INTO ${ORDER_TABLE} (submission_id, option, position, moved_by)
     SELECT id, $3, position, $4 FROM unnest($1::int[], $2::float8[]) AS t(id, position)`,
    [moves.map((m) => m.id), moves.map((m) => m.position), option, by],
  );
}

export type MoveUp = { at: string; mailStatus: 'sent' | 'failed' | 'no-address'; mailError: string | null };

export async function recordMove(
  payload: Payload,
  id: number,
  option: string,
  mailStatus: MoveUp['mailStatus'],
  mailError: string | null,
): Promise<void> {
  await poolOf(payload).query(
    `INSERT INTO ${MOVES_TABLE} (submission_id, option, mail_status, mail_error) VALUES ($1, $2, $3, $4)`,
    [id, option, mailStatus, mailError?.slice(0, 500) ?? null],
  );
}

/** Per registration (of `ids`, or every one), each evening it moved up on from the waitlist – the newest time. */
export async function movesOf(payload: Payload, ids?: number[]): Promise<Map<number, Map<string, MoveUp>>> {
  const out = new Map<number, Map<string, MoveUp>>();
  if (ids && ids.length === 0) return out;
  const { rows } = await poolOf(payload).query(
    `SELECT DISTINCT ON (submission_id, option) submission_id, option, mail_status, mail_error, created_at
     FROM ${MOVES_TABLE}
     ${ids ? 'WHERE submission_id = ANY($1::int[])' : ''}
     ORDER BY submission_id, option, created_at DESC, id DESC`,
    ids ? [ids] : [],
  );
  for (const r of rows) {
    const id = Number(r.submission_id);
    if (!out.has(id)) out.set(id, new Map());
    out.get(id)!.set(String(r.option), {
      at: new Date(r.created_at as string).toISOString(),
      mailStatus: r.mail_status as MoveUp['mailStatus'],
      mailError: (r.mail_error as string | null) ?? null,
    });
  }
  return out;
}
