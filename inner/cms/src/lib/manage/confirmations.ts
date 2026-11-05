import type { Payload } from 'payload';
import { poolOf } from '../../endpoints/util';
import type { EveningTodo } from '../share/evening';
import { CONFIRMATIONS_TABLE } from './tables';

/**
 * The to-dos of an evening (TechTour → Company visits → To-dos) a person
 * ticked on their own /techtour/manage page – e.g. a host's confidentiality
 * agreement. Only INSERT and SELECT, on its own table (lib/manage/tables.ts):
 * a tick is never taken back, and a second one keeps the first one's time.
 */

export type Confirmation = { option: string; todo: string; text: string; linkUrl: string | null; at: string };

/** Per registration (of `ids`), everything it has confirmed, oldest first. */
export async function confirmationsOf(payload: Payload, ids: number[]): Promise<Map<number, Confirmation[]>> {
  const out = new Map<number, Confirmation[]>();
  if (ids.length === 0) return out;
  const { rows } = await poolOf(payload).query(
    `SELECT submission_id, option, todo_id, text, link_url, created_at
     FROM ${CONFIRMATIONS_TABLE}
     WHERE submission_id = ANY($1::int[])
     ORDER BY created_at, id`,
    [ids],
  );
  for (const r of rows) {
    const id = Number(r.submission_id);
    if (!out.has(id)) out.set(id, []);
    out.get(id)!.push({
      option: String(r.option),
      todo: String(r.todo_id),
      text: String(r.text),
      linkUrl: r.link_url == null ? null : String(r.link_url),
      at: new Date(r.created_at as string).toISOString(),
    });
  }
  return out;
}

/** Record the to-dos ticked for an evening, with the wording shown. Returns the ids confirmed just now. */
export async function confirm(
  payload: Payload,
  id: number,
  option: string,
  todos: EveningTodo[],
  locale: 'en' | 'de',
): Promise<string[]> {
  if (todos.length === 0) return [];
  const { rows } = await poolOf(payload).query(
    `INSERT INTO ${CONFIRMATIONS_TABLE} (submission_id, option, todo_id, text, link_url, locale)
     SELECT $1, $2, todo, text, link, $3
     FROM unnest($4::text[], $5::text[], $6::text[]) AS t(todo, text, link)
     ON CONFLICT (submission_id, option, todo_id) DO NOTHING
     RETURNING todo_id`,
    [id, option, locale, todos.map((t) => t.id), todos.map((t) => t.text), todos.map((t) => t.linkUrl)],
  );
  return rows.map((r) => String(r.todo_id));
}
