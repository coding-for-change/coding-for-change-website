import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drops the TechTour and form-builder fields the site never rendered: the
 * page's kicker/title/intro/hero image/highlights/commitment (the poster and
 * the Explore section take their wording from the site's own translations),
 * the per-question "Field Width (percentage)" on every form block, and the
 * "redirect after submit" option, which CmsForm has no handling for.
 *
 * It is a data-destroying migration by design — the dropped columns hold text
 * an editor wrote and no visitor ever saw. It was taken off production before
 * this shipped.
 *
 * `forms_locales.confirmation_message` becomes NOT NULL because it is a
 * required field whose `admin.condition` (shown only while the confirmation
 * type was "message") has gone with the type. All three forms carry a message
 * in both locales, checked against production with the locale fallback off, so
 * the constraint has nothing to reject; a form without one would fail this
 * migration and hold the CMS at the old schema rather than boot on a broken one.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tech_tour_highlights" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tech_tour_highlights_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "tech_tour_highlights" CASCADE;
  DROP TABLE "tech_tour_highlights_locales" CASCADE;
  ALTER TABLE "tech_tour" DROP CONSTRAINT "tech_tour_hero_image_id_media_id_fk";
  
  DROP INDEX "tech_tour_hero_image_idx";
  ALTER TABLE "forms_locales" ALTER COLUMN "confirmation_message" SET NOT NULL;
  ALTER TABLE "forms_blocks_checkbox" DROP COLUMN "width";
  ALTER TABLE "forms_blocks_email" DROP COLUMN "width";
  ALTER TABLE "forms_blocks_number" DROP COLUMN "width";
  ALTER TABLE "forms_blocks_select" DROP COLUMN "width";
  ALTER TABLE "forms_blocks_text" DROP COLUMN "width";
  ALTER TABLE "forms_blocks_textarea" DROP COLUMN "width";
  ALTER TABLE "forms_blocks_upload" DROP COLUMN "width";
  ALTER TABLE "forms_blocks_checkbox_group" DROP COLUMN "width";
  ALTER TABLE "forms" DROP COLUMN "confirmation_type";
  ALTER TABLE "forms" DROP COLUMN "redirect_url";
  ALTER TABLE "tech_tour" DROP COLUMN "hero_image_id";
  ALTER TABLE "tech_tour_locales" DROP COLUMN "kicker";
  ALTER TABLE "tech_tour_locales" DROP COLUMN "title";
  ALTER TABLE "tech_tour_locales" DROP COLUMN "intro";
  ALTER TABLE "tech_tour_locales" DROP COLUMN "commitment";
  DROP TYPE "public"."enum_forms_confirmation_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_forms_confirmation_type" AS ENUM('message', 'redirect');
  CREATE TABLE "tech_tour_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "tech_tour_highlights_locales" (
  	"title" varchar NOT NULL,
  	"text" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  ALTER TABLE "forms_locales" ALTER COLUMN "confirmation_message" DROP NOT NULL;
  ALTER TABLE "forms_blocks_checkbox" ADD COLUMN "width" numeric;
  ALTER TABLE "forms_blocks_email" ADD COLUMN "width" numeric;
  ALTER TABLE "forms_blocks_number" ADD COLUMN "width" numeric;
  ALTER TABLE "forms_blocks_select" ADD COLUMN "width" numeric;
  ALTER TABLE "forms_blocks_text" ADD COLUMN "width" numeric;
  ALTER TABLE "forms_blocks_textarea" ADD COLUMN "width" numeric;
  ALTER TABLE "forms_blocks_upload" ADD COLUMN "width" numeric;
  ALTER TABLE "forms_blocks_checkbox_group" ADD COLUMN "width" numeric;
  ALTER TABLE "forms" ADD COLUMN "confirmation_type" "enum_forms_confirmation_type" DEFAULT 'message';
  ALTER TABLE "forms" ADD COLUMN "redirect_url" varchar;
  ALTER TABLE "tech_tour" ADD COLUMN "hero_image_id" integer;
  ALTER TABLE "tech_tour_locales" ADD COLUMN "kicker" varchar;
  ALTER TABLE "tech_tour_locales" ADD COLUMN "title" varchar;
  ALTER TABLE "tech_tour_locales" ADD COLUMN "intro" varchar;
  ALTER TABLE "tech_tour_locales" ADD COLUMN "commitment" varchar;
  ALTER TABLE "tech_tour_highlights" ADD CONSTRAINT "tech_tour_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tech_tour"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tech_tour_highlights_locales" ADD CONSTRAINT "tech_tour_highlights_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tech_tour_highlights"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "tech_tour_highlights_order_idx" ON "tech_tour_highlights" USING btree ("_order");
  CREATE INDEX "tech_tour_highlights_parent_id_idx" ON "tech_tour_highlights" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "tech_tour_highlights_locales_locale_parent_id_unique" ON "tech_tour_highlights_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "tech_tour" ADD CONSTRAINT "tech_tour_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "tech_tour_hero_image_idx" ON "tech_tour" USING btree ("hero_image_id");`)
}
