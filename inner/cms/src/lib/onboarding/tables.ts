import type { PostgresAdapterArgs } from '@payloadcms/db-postgres';
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from '@payloadcms/db-postgres/drizzle/pg-core';

/**
 * The onboarding of a new member (/admin/onboarding, the member's own
 * /onboarding page): plain tables beside the `users` collection, like the
 * TechTour ones (lib/manage/tables.ts) and for the same reason: a collection
 * would add a column to Payload's `payload_locked_documents_rels`, and these
 * rows are records, not documents anyone edits in the admin.
 *
 * Both point at the member's account with ON DELETE CASCADE: deleting the
 * account takes its onboarding along.
 *
 * Added through the adapter's `afterSchemaInit` so `payload migrate:create`
 * and dev push both know them.
 */

type SchemaHook = NonNullable<PostgresAdapterArgs['afterSchemaInit']>[number];

export const CHECKS_TABLE = 'onboarding_checks';
export const DOCUMENTS_TABLE = 'onboarding_documents';

export const onboardingTables: SchemaHook = ({ schema }) => {
  const users = schema.tables.users;

  // A to-do of the onboarding settings ticked or unticked: by the member on
  // their page (kind "member") or by the board in the dashboard (kind
  // "board"). Never edited: every change is a row of its own, and the newest
  // row per account, kind and to-do holds (lib/onboarding/store.ts). The
  // wording and link as shown are kept, so the row still says what was
  // confirmed when the text in the settings changes later.
  const checks = pgTable(
    CHECKS_TABLE,
    {
      id: serial('id').primaryKey(),
      user: integer('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
      /** "member" or "board". */
      kind: varchar('kind').notNull(),
      /** The to-do's row id in the onboarding global (memberTodos / boardTodos). */
      item: varchar('item_id').notNull(),
      text: varchar('text').notNull(),
      linkUrl: varchar('link_url'),
      /** true: ticked; false: the tick taken back. */
      done: boolean('done').notNull(),
      /** The email of whoever ticked it: the member themselves or a board member. */
      by: varchar('done_by').notNull(),
      /** The page's language when a member ticked it ("de" / "en"); NULL for the board. */
      locale: varchar('locale'),
      createdAt: timestamp('created_at', { mode: 'string', precision: 3, withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (t) => [index(`${CHECKS_TABLE}_user_kind_item_idx`).on(t.user, t.kind, t.item)],
  );

  // A document of the onboarding settings (documents[]) the member signs
  // through DocuSeal: one row per DocuSeal submission started for them. The
  // newest row per account and document holds; its status follows DocuSeal's
  // webhook (work package 4). A document started again after it was declined
  // or expired gets a row of its own.
  const documents = pgTable(
    DOCUMENTS_TABLE,
    {
      id: serial('id').primaryKey(),
      user: integer('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
      /** The document's row id in the onboarding global (documents[]). */
      item: varchar('item_id').notNull(),
      /** The document's title when it was started, as the member saw it. */
      title: varchar('title').notNull(),
      /** The DocuSeal template it was started from. */
      templateId: integer('docuseal_template_id').notNull(),
      /** DocuSeal's submission id. */
      submissionId: integer('docuseal_submission_id').notNull(),
      /** The member's submitter slug in it: their signing link is <DOCUSEAL_URL>/s/<slug>. */
      submitterSlug: varchar('docuseal_submitter_slug').notNull(),
      /** "pending" (started), "opened", "completed", "declined" or "expired". */
      status: varchar('status').notNull().default('pending'),
      createdAt: timestamp('created_at', { mode: 'string', precision: 3, withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp('updated_at', { mode: 'string', precision: 3, withTimezone: true })
        .defaultNow()
        .notNull(),
      completedAt: timestamp('completed_at', { mode: 'string', precision: 3, withTimezone: true }),
    },
    (t) => [
      index(`${DOCUMENTS_TABLE}_user_item_idx`).on(t.user, t.item),
      // The webhook finds the row by DocuSeal's id; once per submission.
      uniqueIndex(`${DOCUMENTS_TABLE}_submission_idx`).on(t.submissionId),
    ],
  );

  return {
    ...schema,
    tables: { ...schema.tables, [CHECKS_TABLE]: checks, [DOCUMENTS_TABLE]: documents },
  };
};
