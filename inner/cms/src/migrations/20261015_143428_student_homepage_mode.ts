import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_config_homepage_mode" AS ENUM('partners', 'students');
  ALTER TABLE "site_config" ADD COLUMN "homepage_mode" "enum_site_config_homepage_mode" DEFAULT 'partners' NOT NULL;
  ALTER TABLE "homepage_locales" ADD COLUMN "student_hero_title" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "student_hero_lead" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "student_hero_cta_primary" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "student_hero_cta_secondary" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "student_why_heading" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "student_why_intro" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "student_projects_title" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "student_projects_intro" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_config" DROP COLUMN "homepage_mode";
  ALTER TABLE "homepage_locales" DROP COLUMN "student_hero_title";
  ALTER TABLE "homepage_locales" DROP COLUMN "student_hero_lead";
  ALTER TABLE "homepage_locales" DROP COLUMN "student_hero_cta_primary";
  ALTER TABLE "homepage_locales" DROP COLUMN "student_hero_cta_secondary";
  ALTER TABLE "homepage_locales" DROP COLUMN "student_why_heading";
  ALTER TABLE "homepage_locales" DROP COLUMN "student_why_intro";
  ALTER TABLE "homepage_locales" DROP COLUMN "student_projects_title";
  ALTER TABLE "homepage_locales" DROP COLUMN "student_projects_intro";
  DROP TYPE "public"."enum_site_config_homepage_mode";`)
}
