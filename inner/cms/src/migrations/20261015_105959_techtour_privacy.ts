import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "forms_blocks_upload" ADD COLUMN "alternative" varchar;
  ALTER TABLE "tech_tour" ADD COLUMN "delete_registrations_on" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "forms_blocks_upload" DROP COLUMN "alternative";
  ALTER TABLE "tech_tour" DROP COLUMN "delete_registrations_on";`)
}
