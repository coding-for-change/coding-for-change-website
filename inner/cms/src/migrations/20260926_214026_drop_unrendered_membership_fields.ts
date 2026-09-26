import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drops the Membership global's fields the redesigned Join page no longer
 * renders: the benefits, requirements and "ways to contribute" tracks, and the
 * optional hero image. The page's copy for all of that now lives in the site's
 * translations; only the title, description and contact email stay here.
 *
 * It is a data-destroying migration by design – the dropped rows hold copy the
 * page stopped showing. Their last contents (EN + DE) are quoted in the commit
 * that added this migration. It touches nothing but the `membership_*` tables:
 * form submissions, applicant files (CVs) and waitlist signups are untouched.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "membership_benefits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "membership_benefits_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "membership_requirements" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "membership_requirements_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "membership_tracks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "membership_tracks_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "membership_benefits" CASCADE;
  DROP TABLE "membership_benefits_locales" CASCADE;
  DROP TABLE "membership_requirements" CASCADE;
  DROP TABLE "membership_requirements_locales" CASCADE;
  DROP TABLE "membership_tracks" CASCADE;
  DROP TABLE "membership_tracks_locales" CASCADE;
  ALTER TABLE "membership" DROP CONSTRAINT "membership_hero_image_id_media_id_fk";
  
  DROP INDEX "membership_hero_image_idx";
  ALTER TABLE "membership" DROP COLUMN "hero_image_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "membership_benefits" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "membership_benefits_locales" (
  	"text" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "membership_requirements" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "membership_requirements_locales" (
  	"text" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "membership_tracks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "membership_tracks_locales" (
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  ALTER TABLE "membership" ADD COLUMN "hero_image_id" integer;
  ALTER TABLE "membership_benefits" ADD CONSTRAINT "membership_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."membership"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "membership_benefits_locales" ADD CONSTRAINT "membership_benefits_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."membership_benefits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "membership_requirements" ADD CONSTRAINT "membership_requirements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."membership"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "membership_requirements_locales" ADD CONSTRAINT "membership_requirements_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."membership_requirements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "membership_tracks" ADD CONSTRAINT "membership_tracks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."membership"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "membership_tracks_locales" ADD CONSTRAINT "membership_tracks_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."membership_tracks"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "membership_benefits_order_idx" ON "membership_benefits" USING btree ("_order");
  CREATE INDEX "membership_benefits_parent_id_idx" ON "membership_benefits" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "membership_benefits_locales_locale_parent_id_unique" ON "membership_benefits_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "membership_requirements_order_idx" ON "membership_requirements" USING btree ("_order");
  CREATE INDEX "membership_requirements_parent_id_idx" ON "membership_requirements" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "membership_requirements_locales_locale_parent_id_unique" ON "membership_requirements_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "membership_tracks_order_idx" ON "membership_tracks" USING btree ("_order");
  CREATE INDEX "membership_tracks_parent_id_idx" ON "membership_tracks" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "membership_tracks_locales_locale_parent_id_unique" ON "membership_tracks_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "membership" ADD CONSTRAINT "membership_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "membership_hero_image_idx" ON "membership" USING btree ("hero_image_id");`)
}
