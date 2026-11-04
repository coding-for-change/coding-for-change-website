import type { PostgresAdapterArgs } from '@payloadcms/db-postgres';
import {
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  smallint,
  timestamp,
  varchar,
} from '@payloadcms/db-postgres/drizzle/pg-core';

/**
 * What a host does on its share link besides admit and decline
 * (lib/share/registrations.ts), and what the waitlist does on its own:
 *
 * - `techtour_host_scores`: the host's 1–10 rating of a person for its
 *   evening (when the link shows the scale). One row per rating given,
 *   changed or taken back (null) – the newest row stands.
 * - `techtour_waitlist_order`: where the host moved someone on its waitlist
 *   (the ↑/↓ on the page). One row per move – the newest row since the person
 *   was put on the waitlist stands; without one, first waitlisted first.
 * - `techtour_waitlist_moves`: each time someone moved up from the waitlist on
 *   their own, because an admitted person gave the evening up through their
 *   link (lib/share/moveUp.ts) – and whether the mail telling them went out.
 *
 * The decision itself (admitted / waitlisted / declined) stays where it was,
 * in the registration's `hostDecisions`, so everything that reads it (the
 * review workspace, the mailing tool, the export) sees the waitlist too.
 *
 * Plain tables, not collections, like lib/manage/tables.ts: nothing here
 * writes to an existing table, and nothing is ever edited or deleted – only
 * inserted. Each row points at its registration with ON DELETE CASCADE and
 * goes with it (by hand in the admin, or TechTour → "Delete registrations
 * on", lib/retention.ts).
 *
 * Added through the adapter's `afterSchemaInit` so `payload migrate:create`
 * and dev push both know them.
 */

type SchemaHook = NonNullable<PostgresAdapterArgs['afterSchemaInit']>[number];

export const SCORES_TABLE = 'techtour_host_scores';
export const ORDER_TABLE = 'techtour_waitlist_order';
export const MOVES_TABLE = 'techtour_waitlist_moves';

const at = (name: string) => timestamp(name, { mode: 'string', precision: 3, withTimezone: true });

export const hostTables: SchemaHook = ({ schema }) => {
  const submissions = schema.tables.form_submissions;

  const scores = pgTable(
    SCORES_TABLE,
    {
      id: serial('id').primaryKey(),
      submission: integer('submission_id')
        .notNull()
        .references(() => submissions.id, { onDelete: 'cascade' }),
      /** The evening's option key, as in the registration's `choiceKeys`. */
      option: varchar('option').notNull(),
      /** 1–10; null = rating taken back. */
      score: smallint('score'),
      /** The signed-in contact's email. */
      by: varchar('scored_by').notNull(),
      createdAt: at('created_at').defaultNow().notNull(),
    },
    (t) => [index(`${SCORES_TABLE}_submission_idx`).on(t.submission)],
  );

  const order = pgTable(
    ORDER_TABLE,
    {
      id: serial('id').primaryKey(),
      submission: integer('submission_id')
        .notNull()
        .references(() => submissions.id, { onDelete: 'cascade' }),
      option: varchar('option').notNull(),
      /** Smaller is further up. Without a row: the time (ms) the person was put on the waitlist. */
      position: doublePrecision('position').notNull(),
      by: varchar('moved_by').notNull(),
      createdAt: at('created_at').defaultNow().notNull(),
    },
    (t) => [index(`${ORDER_TABLE}_submission_idx`).on(t.submission)],
  );

  const moves = pgTable(
    MOVES_TABLE,
    {
      id: serial('id').primaryKey(),
      submission: integer('submission_id')
        .notNull()
        .references(() => submissions.id, { onDelete: 'cascade' }),
      option: varchar('option').notNull(),
      /** sent · failed · no-address */
      mailStatus: varchar('mail_status').notNull(),
      mailError: varchar('mail_error'),
      createdAt: at('created_at').defaultNow().notNull(),
    },
    (t) => [index(`${MOVES_TABLE}_submission_idx`).on(t.submission)],
  );

  return {
    ...schema,
    tables: { ...schema.tables, [SCORES_TABLE]: scores, [ORDER_TABLE]: order, [MOVES_TABLE]: moves },
  };
};
