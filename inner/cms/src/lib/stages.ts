import type { PostgresAdapterArgs } from '@payloadcms/db-postgres';
import { index, integer, pgTable, serial, timestamp, varchar } from '@payloadcms/db-postgres/drizzle/pg-core';
import type { Payload } from 'payload';
import { poolOf } from '../endpoints/util';
import type { ApplicationStage } from './stageOptions';

/**
 * Where a membership application stands after the written review – interview
 * held, admitted, not admitted, withdrew (lib/stageOptions.ts) – set by hand in
 * the review workspace (/admin/review, endpoints/stages.ts) and counted in the
 * analytics funnel (endpoints/analyticsApplications.ts).
 *
 * A plain table, like the member mark (lib/members.ts) and for the same
 * reason: a collection would add a column to Payload's
 * `payload_locked_documents_rels`, and the application (`form_submissions`)
 * is not written to. Every change is a row of its own with its time and who
 * set it – setting a stage and clearing it (stage NULL) both add one, and the
 * newest row per application is what holds. Nothing is updated or deleted,
 * except with the application itself (ON DELETE CASCADE, so deleting an
 * application by hand or through the retention purge takes it along).
 */

type SchemaHook = NonNullable<PostgresAdapterArgs['afterSchemaInit']>[number];

export const STAGES_TABLE = 'application_stages';

export const stageTables: SchemaHook = ({ schema }) => {
  const submissions = schema.tables.form_submissions;

  const stages = pgTable(
    STAGES_TABLE,
    {
      id: serial('id').primaryKey(),
      submission: integer('submission_id')
        .notNull()
        .references(() => submissions.id, { onDelete: 'cascade' }),
      /** One of APPLICATION_STAGES; NULL = cleared. */
      stage: varchar('stage'),
      /** The admin's email. */
      by: varchar('changed_by').notNull(),
      createdAt: timestamp('created_at', { mode: 'string', precision: 3, withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (t) => [index(`${STAGES_TABLE}_submission_idx`).on(t.submission)],
  );

  return { ...schema, tables: { ...schema.tables, [STAGES_TABLE]: stages } };
};

/** SQL for the current stage per application (the newest row; cleared ones left out). */
export const CURRENT_STAGES_SQL = `
  SELECT submission_id, stage FROM (
    SELECT DISTINCT ON (submission_id) submission_id, stage
    FROM ${STAGES_TABLE}
    ORDER BY submission_id, id DESC
  ) newest
  WHERE stage IS NOT NULL`;

/** The current stage of every application that has one. */
export async function currentStages(payload: Payload): Promise<Map<number, ApplicationStage>> {
  const { rows } = await poolOf(payload).query(CURRENT_STAGES_SQL);
  return new Map(rows.map((r) => [Number(r.submission_id), r.stage as ApplicationStage]));
}

/** Set an application's stage, or clear it (null). */
export async function setStage(
  payload: Payload,
  id: number,
  stage: ApplicationStage | null,
  by: string,
): Promise<void> {
  await poolOf(payload).query(
    `INSERT INTO ${STAGES_TABLE} (submission_id, stage, changed_by) VALUES ($1, $2, $3)`,
    [id, stage, by],
  );
}
