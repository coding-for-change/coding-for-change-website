import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tech_tour_visibility" AS ENUM('hidden', 'unlisted', 'public');
  ALTER TABLE "tech_tour" ADD COLUMN "visibility" "enum_tech_tour_visibility" DEFAULT 'unlisted';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tech_tour" DROP COLUMN "visibility";
  DROP TYPE "public"."enum_tech_tour_visibility";`)
}
