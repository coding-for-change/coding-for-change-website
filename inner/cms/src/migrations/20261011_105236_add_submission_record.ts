import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_form_submissions_language" AS ENUM('en', 'de');
  ALTER TABLE "form_submissions" ADD COLUMN "language" "enum_form_submissions_language";
  ALTER TABLE "form_submissions" ADD COLUMN "agreed_to" jsonb;
  ALTER TABLE "form_submissions" ADD COLUMN "choice_keys" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "form_submissions" DROP COLUMN "language";
  ALTER TABLE "form_submissions" DROP COLUMN "agreed_to";
  ALTER TABLE "form_submissions" DROP COLUMN "choice_keys";
  DROP TYPE "public"."enum_form_submissions_language";`)
}
