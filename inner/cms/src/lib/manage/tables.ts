import type { PostgresAdapterArgs } from '@payloadcms/db-postgres';
import { integer, pgTable, serial, timestamp, uniqueIndex, varchar } from '@payloadcms/db-postgres/drizzle/pg-core';

/**
 * The two tables behind /techtour/manage (endpoints/manage.ts): a personal
 * link per TechTour registration, and the evenings a person has withdrawn
 * from through it.
 *
 * Plain tables, not collections, on purpose. A collection would also add a
 * column to Payload's `payload_locked_documents_rels`, and the registrations
 * themselves (`form_submissions`) are not to be touched at all: nothing here
 * writes to an existing table. A withdrawal is a row of its own, with its
 * time, and the registration keeps every evening it was sent with – the host
 * page and the admin leave the withdrawn ones out when they read
 * (lib/manage/store.ts).
 *
 * Both point at their registration with ON DELETE CASCADE, so they go with it:
 * by hand in the admin, or on TechTour → "Delete registrations on"
 * (lib/retention.ts).
 *
 * Added through the adapter's `afterSchemaInit` so `payload migrate:create`
 * and dev push both know them.
 */

type SchemaHook = NonNullable<PostgresAdapterArgs['afterSchemaInit']>[number];

export const TOKENS_TABLE = 'techtour_manage_tokens';
export const WITHDRAWALS_TABLE = 'techtour_withdrawals';

export const manageTables: SchemaHook = ({ schema }) => {
  const submissions = schema.tables.form_submissions;

  const tokens = pgTable(
    TOKENS_TABLE,
    {
      id: serial('id').primaryKey(),
      submission: integer('submission_id')
        .notNull()
        .references(() => submissions.id, { onDelete: 'cascade' }),
      /** 32 random bytes, base64url (43 characters). */
      token: varchar('token').notNull(),
      createdAt: timestamp('created_at', { mode: 'string', precision: 3, withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (t) => [
      uniqueIndex(`${TOKENS_TABLE}_token_idx`).on(t.token),
      uniqueIndex(`${TOKENS_TABLE}_submission_idx`).on(t.submission),
    ],
  );

  const withdrawals = pgTable(
    WITHDRAWALS_TABLE,
    {
      id: serial('id').primaryKey(),
      submission: integer('submission_id')
        .notNull()
        .references(() => submissions.id, { onDelete: 'cascade' }),
      /** The evening's option key, as in the registration's `choiceKeys` (e.g. "tue-lio"). */
      option: varchar('option').notNull(),
      createdAt: timestamp('created_at', { mode: 'string', precision: 3, withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    // Once per evening: the first withdrawal stands, with its time.
    (t) => [uniqueIndex(`${WITHDRAWALS_TABLE}_submission_option_idx`).on(t.submission, t.option)],
  );

  return {
    ...schema,
    tables: { ...schema.tables, [TOKENS_TABLE]: tokens, [WITHDRAWALS_TABLE]: withdrawals },
  };
};
