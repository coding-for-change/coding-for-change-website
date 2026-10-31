import type { PostgresAdapterArgs } from '@payloadcms/db-postgres';
import { boolean, index, integer, pgTable, serial, timestamp } from '@payloadcms/db-postgres/drizzle/pg-core';
import type { Payload } from 'payload';
import { poolOf } from '../endpoints/util';

/**
 * "Coding for Change member" on a TechTour registration: set by hand in the
 * review workspace (/admin/review, endpoints/members.ts) – people register with
 * whatever address they like, so it cannot be matched. The host page shows it
 * as a badge (lib/share/page.ts), and the mass mail can go to members only
 * (endpoints/waitlistEmail.ts).
 *
 * A plain table, like the /techtour/manage ones (lib/manage/tables.ts) and for
 * the same reason: a collection would add a column to Payload's
 * `payload_locked_documents_rels`, and the registration (`form_submissions`)
 * is not written to. Every mark is a row of its own with its time – setting it
 * and taking it back both add one, and the newest row per registration is what
 * holds. Nothing is updated or deleted, except with the registration itself
 * (ON DELETE CASCADE, so the retention purge takes it along).
 */

type SchemaHook = NonNullable<PostgresAdapterArgs['afterSchemaInit']>[number];

export const MEMBERS_TABLE = 'techtour_members';

export const memberTables: SchemaHook = ({ schema }) => {
  const submissions = schema.tables.form_submissions;

  const members = pgTable(
    MEMBERS_TABLE,
    {
      id: serial('id').primaryKey(),
      submission: integer('submission_id')
        .notNull()
        .references(() => submissions.id, { onDelete: 'cascade' }),
      /** true: marked as a member; false: the mark taken back. */
      member: boolean('member').notNull(),
      createdAt: timestamp('created_at', { mode: 'string', precision: 3, withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (t) => [index(`${MEMBERS_TABLE}_submission_idx`).on(t.submission)],
  );

  return { ...schema, tables: { ...schema.tables, [MEMBERS_TABLE]: members } };
};

/** The registrations marked as members – all of them, or those among `ids`. */
export async function membersAmong(payload: Payload, ids?: number[]): Promise<Set<number>> {
  if (ids && ids.length === 0) return new Set();
  const { rows } = await poolOf(payload).query(
    `SELECT submission_id FROM (
       SELECT DISTINCT ON (submission_id) submission_id, member
       FROM ${MEMBERS_TABLE}
       ${ids ? 'WHERE submission_id = ANY($1::int[])' : ''}
       ORDER BY submission_id, id DESC
     ) newest
     WHERE member`,
    ids ? [ids] : [],
  );
  return new Set(rows.map((r) => Number(r.submission_id)));
}

/** Mark a registration as a member, or take the mark back. */
export async function markMember(payload: Payload, id: number, member: boolean): Promise<void> {
  await poolOf(payload).query(`INSERT INTO ${MEMBERS_TABLE} (submission_id, member) VALUES ($1, $2)`, [
    id,
    member,
  ]);
}
