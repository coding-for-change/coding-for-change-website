import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_form_submissions_source" AS ENUM('speedrun');
  ALTER TABLE "form_submissions" ADD COLUMN "source" "enum_form_submissions_source";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "form_submissions" DROP COLUMN "source";
  DROP TYPE "public"."enum_form_submissions_source";`)
}
