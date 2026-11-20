import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_homepage_testimonials_audience" AS ENUM('ngo', 'company', 'member');
  CREATE TABLE "homepage_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"audience" "enum_homepage_testimonials_audience" DEFAULT 'ngo' NOT NULL,
  	"name" varchar,
  	"organisation" varchar,
  	"photo_id" integer
  );
  
  CREATE TABLE "homepage_testimonials_locales" (
  	"quote" varchar NOT NULL,
  	"role" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  DROP TABLE "homepage_stats" CASCADE;
  DROP TABLE "homepage_stats_locales" CASCADE;
  ALTER TABLE "homepage_testimonials" ADD CONSTRAINT "homepage_testimonials_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_testimonials" ADD CONSTRAINT "homepage_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_testimonials_locales" ADD CONSTRAINT "homepage_testimonials_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "homepage_testimonials_order_idx" ON "homepage_testimonials" USING btree ("_order");
  CREATE INDEX "homepage_testimonials_parent_id_idx" ON "homepage_testimonials" USING btree ("_parent_id");
  CREATE INDEX "homepage_testimonials_photo_idx" ON "homepage_testimonials" USING btree ("photo_id");
  CREATE UNIQUE INDEX "homepage_testimonials_locales_locale_parent_id_unique" ON "homepage_testimonials_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "homepage_locales" DROP COLUMN "hero_kicker";
  ALTER TABLE "homepage_locales" DROP COLUMN "hero_scroll_hint";
  ALTER TABLE "homepage_locales" DROP COLUMN "about_kicker";
  ALTER TABLE "homepage_locales" DROP COLUMN "events_subtitle";
  ALTER TABLE "homepage_locales" DROP COLUMN "events_title";
  ALTER TABLE "homepage_locales" DROP COLUMN "events_intro";
  ALTER TABLE "homepage_locales" DROP COLUMN "sponsors_subtitle";
  ALTER TABLE "homepage_locales" DROP COLUMN "sponsors_title";
  ALTER TABLE "homepage_locales" DROP COLUMN "sponsors_intro";
  ALTER TABLE "homepage_locales" DROP COLUMN "threed_kicker";
  ALTER TABLE "homepage_locales" DROP COLUMN "threed_title";
  ALTER TABLE "homepage_locales" DROP COLUMN "threed_text";
  ALTER TABLE "homepage_locales" DROP COLUMN "threed_cta";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "homepage_stats" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "homepage_stats_locales" (
  	"value" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  DROP TABLE "homepage_testimonials" CASCADE;
  DROP TABLE "homepage_testimonials_locales" CASCADE;
  ALTER TABLE "homepage_locales" ADD COLUMN "hero_kicker" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "hero_scroll_hint" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "about_kicker" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "events_subtitle" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "events_title" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "events_intro" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "sponsors_subtitle" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "sponsors_title" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "sponsors_intro" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "threed_kicker" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "threed_title" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "threed_text" varchar;
  ALTER TABLE "homepage_locales" ADD COLUMN "threed_cta" varchar;
  ALTER TABLE "homepage_stats" ADD CONSTRAINT "homepage_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_stats_locales" ADD CONSTRAINT "homepage_stats_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_stats"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "homepage_stats_order_idx" ON "homepage_stats" USING btree ("_order");
  CREATE INDEX "homepage_stats_parent_id_idx" ON "homepage_stats" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "homepage_stats_locales_locale_parent_id_unique" ON "homepage_stats_locales" USING btree ("_locale","_parent_id");
  DROP TYPE "public"."enum_homepage_testimonials_audience";`)
}
