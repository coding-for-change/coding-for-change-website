import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_form_submissions_review_status" AS ENUM('unreviewed', 'accepted', 'unsure', 'rejected');
  ALTER TABLE "form_submissions" ADD COLUMN "review_status" "enum_form_submissions_review_status" DEFAULT 'unreviewed';
  ALTER TABLE "form_submissions" ADD COLUMN "review_notes" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "form_submissions" DROP COLUMN "review_status";
  ALTER TABLE "form_submissions" DROP COLUMN "review_notes";
  DROP TYPE "public"."enum_form_submissions_review_status";`)
}
