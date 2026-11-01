import type { PostgresAdapterArgs } from '@payloadcms/db-postgres';
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from '@payloadcms/db-postgres/drizzle/pg-core';

/**
 * The tables behind the mailing tool (/admin/mailing, lib/mailing/model.ts):
 *
 * - `mailings`: a mailing – its title, source and groups (filters + texts).
 *   Edited freely until and between sends; what went out is kept below.
 * - `mailing_sends`: each time a mailing was sent – who, when, how many – with
 *   the groups as they were at that moment.
 * - `mailing_recipients`: every mail of a send, as it was sent – subject, html
 *   and text, the group it came from, the provider's id and whether it went
 *   out. This is the history: what exactly a person got, even after the texts
 *   or the template change. A mailing reaches each person once by looking here.
 *
 * Plain tables, not collections, like the /techtour/manage ones
 * (lib/manage/tables.ts): a collection would add a column to Payload's
 * `payload_locked_documents_rels`, and nothing here writes to an existing
 * table. A recipient row holds personal data, so it points at the person it
 * was sent to – an application (`form_submissions`) or a waitlist signup –
 * with ON DELETE CASCADE and goes with them: by hand in the admin or through
 * the retention purges (lib/retention.ts). The mailing and its send counts
 * stay.
 *
 * Added through the adapter's `afterSchemaInit` so `payload migrate:create`
 * and dev push both know them.
 */

type SchemaHook = NonNullable<PostgresAdapterArgs['afterSchemaInit']>[number];

export const MAILINGS_TABLE = 'mailings';
export const SENDS_TABLE = 'mailing_sends';
export const RECIPIENTS_TABLE = 'mailing_recipients';

const at = (name: string) => timestamp(name, { mode: 'string', precision: 3, withTimezone: true });

export const mailingTables: SchemaHook = ({ schema }) => {
  const submissions = schema.tables.form_submissions;
  const signups = schema.tables.waitlist_signups;

  const mailings = pgTable(MAILINGS_TABLE, {
    id: serial('id').primaryKey(),
    title: varchar('title').notNull(),
    /** lib/mailing/model.ts `SourceKey`. */
    source: varchar('source').notNull(),
    /** lib/mailing/model.ts `MailingConfig`. */
    config: jsonb('config').notNull(),
    createdBy: varchar('created_by'),
    createdAt: at('created_at').defaultNow().notNull(),
    updatedBy: varchar('updated_by'),
    updatedAt: at('updated_at').defaultNow().notNull(),
    /** Set while a send runs, so a second click (or a second admin) cannot start another. */
    sendingSince: at('sending_since'),
  });

  const sends = pgTable(
    SENDS_TABLE,
    {
      id: serial('id').primaryKey(),
      mailing: integer('mailing_id')
        .notNull()
        .references(() => mailings.id, { onDelete: 'cascade' }),
      sentBy: varchar('sent_by'),
      startedAt: at('started_at').defaultNow().notNull(),
      finishedAt: at('finished_at'),
      requested: integer('requested').notNull().default(0),
      sent: integer('sent').notNull().default(0),
      failed: integer('failed').notNull().default(0),
      /** The mailing's groups as they were sent. */
      config: jsonb('config').notNull(),
    },
    (t) => [index(`${SENDS_TABLE}_mailing_idx`).on(t.mailing)],
  );

  const recipients = pgTable(
    RECIPIENTS_TABLE,
    {
      id: serial('id').primaryKey(),
      mailing: integer('mailing_id')
        .notNull()
        .references(() => mailings.id, { onDelete: 'cascade' }),
      send: integer('send_id')
        .notNull()
        .references(() => sends.id, { onDelete: 'cascade' }),
      submission: integer('submission_id').references(() => submissions.id, { onDelete: 'cascade' }),
      waitlistSignup: integer('waitlist_signup_id').references(() => signups.id, { onDelete: 'cascade' }),
      /** Lower-cased. */
      email: varchar('email').notNull(),
      name: varchar('name'),
      groupId: varchar('group_id').notNull(),
      groupLabel: varchar('group_label').notNull(),
      lang: varchar('lang').notNull(),
      subject: varchar('subject').notNull(),
      html: text('html').notNull(),
      text: text('text').notNull(),
      /** pending (handed over, no answer yet) · sent · failed */
      status: varchar('status').notNull(),
      providerId: varchar('provider_id'),
      error: varchar('error'),
      createdAt: at('created_at').defaultNow().notNull(),
      sentAt: at('sent_at'),
    },
    (t) => [
      index(`${RECIPIENTS_TABLE}_mailing_idx`).on(t.mailing),
      index(`${RECIPIENTS_TABLE}_send_idx`).on(t.send),
      index(`${RECIPIENTS_TABLE}_email_idx`).on(t.email),
      index(`${RECIPIENTS_TABLE}_submission_idx`).on(t.submission),
      index(`${RECIPIENTS_TABLE}_waitlist_signup_idx`).on(t.waitlistSignup),
    ],
  );

  return {
    ...schema,
    tables: { ...schema.tables, [MAILINGS_TABLE]: mailings, [SENDS_TABLE]: sends, [RECIPIENTS_TABLE]: recipients },
  };
};
