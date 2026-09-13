import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tech_tour_events_status" AS ENUM('confirmed', 'tentative', 'tba');
  CREATE TABLE "applicant_files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "forms_blocks_upload" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_upload_locales" (
  	"label" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_checkbox_group_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_checkbox_group_options_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_checkbox_group" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_checkbox_group_locales" (
  	"label" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_subform" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"form_id" integer NOT NULL,
  	"link_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_subform_locales" (
  	"label" varchar NOT NULL,
  	"description" varchar,
  	"link_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "form_submissions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"applicant_files_id" integer
  );
  
  CREATE TABLE "tech_tour_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"company" varchar NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"logo_id" integer,
  	"website" varchar,
  	"status" "enum_tech_tour_events_status" DEFAULT 'confirmed'
  );
  
  CREATE TABLE "tech_tour_events_locales" (
  	"title" varchar,
  	"time" varchar,
  	"location" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
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
  
  CREATE TABLE "tech_tour" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_image_id" integer,
  	"registration_open" boolean DEFAULT true,
  	"registration_deadline" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "tech_tour_locales" (
  	"kicker" varchar,
  	"title" varchar,
  	"intro" varchar,
  	"commitment" varchar,
  	"form_heading" varchar,
  	"closed_message" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "tech_tour_find" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "tech_tour_update" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "applicant_files_id" integer;
  ALTER TABLE "forms_blocks_upload" ADD CONSTRAINT "forms_blocks_upload_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_upload_locales" ADD CONSTRAINT "forms_blocks_upload_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_upload"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_checkbox_group_options" ADD CONSTRAINT "forms_blocks_checkbox_group_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_checkbox_group"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_checkbox_group_options_locales" ADD CONSTRAINT "forms_blocks_checkbox_group_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_checkbox_group_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_checkbox_group" ADD CONSTRAINT "forms_blocks_checkbox_group_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_checkbox_group_locales" ADD CONSTRAINT "forms_blocks_checkbox_group_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_checkbox_group"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_subform" ADD CONSTRAINT "forms_blocks_subform_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "forms_blocks_subform" ADD CONSTRAINT "forms_blocks_subform_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_subform_locales" ADD CONSTRAINT "forms_blocks_subform_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_subform"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "form_submissions_rels" ADD CONSTRAINT "form_submissions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "form_submissions_rels" ADD CONSTRAINT "form_submissions_rels_applicant_files_fk" FOREIGN KEY ("applicant_files_id") REFERENCES "public"."applicant_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tech_tour_events" ADD CONSTRAINT "tech_tour_events_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tech_tour_events" ADD CONSTRAINT "tech_tour_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tech_tour"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tech_tour_events_locales" ADD CONSTRAINT "tech_tour_events_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tech_tour_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tech_tour_highlights" ADD CONSTRAINT "tech_tour_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tech_tour"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tech_tour_highlights_locales" ADD CONSTRAINT "tech_tour_highlights_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tech_tour_highlights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tech_tour" ADD CONSTRAINT "tech_tour_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tech_tour_locales" ADD CONSTRAINT "tech_tour_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tech_tour"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "applicant_files_updated_at_idx" ON "applicant_files" USING btree ("updated_at");
  CREATE INDEX "applicant_files_created_at_idx" ON "applicant_files" USING btree ("created_at");
  CREATE UNIQUE INDEX "applicant_files_filename_idx" ON "applicant_files" USING btree ("filename");
  CREATE INDEX "forms_blocks_upload_order_idx" ON "forms_blocks_upload" USING btree ("_order");
  CREATE INDEX "forms_blocks_upload_parent_id_idx" ON "forms_blocks_upload" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_upload_path_idx" ON "forms_blocks_upload" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_upload_locales_locale_parent_id_unique" ON "forms_blocks_upload_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_checkbox_group_options_order_idx" ON "forms_blocks_checkbox_group_options" USING btree ("_order");
  CREATE INDEX "forms_blocks_checkbox_group_options_parent_id_idx" ON "forms_blocks_checkbox_group_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "forms_blocks_checkbox_group_options_locales_locale_parent_id" ON "forms_blocks_checkbox_group_options_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_checkbox_group_order_idx" ON "forms_blocks_checkbox_group" USING btree ("_order");
  CREATE INDEX "forms_blocks_checkbox_group_parent_id_idx" ON "forms_blocks_checkbox_group" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_checkbox_group_path_idx" ON "forms_blocks_checkbox_group" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_checkbox_group_locales_locale_parent_id_unique" ON "forms_blocks_checkbox_group_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_subform_order_idx" ON "forms_blocks_subform" USING btree ("_order");
  CREATE INDEX "forms_blocks_subform_parent_id_idx" ON "forms_blocks_subform" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_subform_path_idx" ON "forms_blocks_subform" USING btree ("_path");
  CREATE INDEX "forms_blocks_subform_form_idx" ON "forms_blocks_subform" USING btree ("form_id");
  CREATE UNIQUE INDEX "forms_blocks_subform_locales_locale_parent_id_unique" ON "forms_blocks_subform_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "form_submissions_rels_order_idx" ON "form_submissions_rels" USING btree ("order");
  CREATE INDEX "form_submissions_rels_parent_idx" ON "form_submissions_rels" USING btree ("parent_id");
  CREATE INDEX "form_submissions_rels_path_idx" ON "form_submissions_rels" USING btree ("path");
  CREATE INDEX "form_submissions_rels_applicant_files_id_idx" ON "form_submissions_rels" USING btree ("applicant_files_id");
  CREATE INDEX "tech_tour_events_order_idx" ON "tech_tour_events" USING btree ("_order");
  CREATE INDEX "tech_tour_events_parent_id_idx" ON "tech_tour_events" USING btree ("_parent_id");
  CREATE INDEX "tech_tour_events_logo_idx" ON "tech_tour_events" USING btree ("logo_id");
  CREATE UNIQUE INDEX "tech_tour_events_locales_locale_parent_id_unique" ON "tech_tour_events_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "tech_tour_highlights_order_idx" ON "tech_tour_highlights" USING btree ("_order");
  CREATE INDEX "tech_tour_highlights_parent_id_idx" ON "tech_tour_highlights" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "tech_tour_highlights_locales_locale_parent_id_unique" ON "tech_tour_highlights_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "tech_tour_hero_image_idx" ON "tech_tour" USING btree ("hero_image_id");
  CREATE UNIQUE INDEX "tech_tour_locales_locale_parent_id_unique" ON "tech_tour_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_applicant_files_fk" FOREIGN KEY ("applicant_files_id") REFERENCES "public"."applicant_files"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_applicant_files_id_idx" ON "payload_locked_documents_rels" USING btree ("applicant_files_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "applicant_files" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_upload" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_upload_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_checkbox_group_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_checkbox_group_options_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_checkbox_group" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_checkbox_group_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_subform" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_subform_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "form_submissions_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tech_tour_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tech_tour_events_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tech_tour_highlights" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tech_tour_highlights_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tech_tour" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tech_tour_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "applicant_files" CASCADE;
  DROP TABLE "forms_blocks_upload" CASCADE;
  DROP TABLE "forms_blocks_upload_locales" CASCADE;
  DROP TABLE "forms_blocks_checkbox_group_options" CASCADE;
  DROP TABLE "forms_blocks_checkbox_group_options_locales" CASCADE;
  DROP TABLE "forms_blocks_checkbox_group" CASCADE;
  DROP TABLE "forms_blocks_checkbox_group_locales" CASCADE;
  DROP TABLE "forms_blocks_subform" CASCADE;
  DROP TABLE "forms_blocks_subform_locales" CASCADE;
  DROP TABLE "form_submissions_rels" CASCADE;
  DROP TABLE "tech_tour_events" CASCADE;
  DROP TABLE "tech_tour_events_locales" CASCADE;
  DROP TABLE "tech_tour_highlights" CASCADE;
  DROP TABLE "tech_tour_highlights_locales" CASCADE;
  DROP TABLE "tech_tour" CASCADE;
  DROP TABLE "tech_tour_locales" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_applicant_files_fk";
  
  DROP INDEX "payload_locked_documents_rels_applicant_files_id_idx";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "tech_tour_find";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "tech_tour_update";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "applicant_files_id";
  DROP TYPE "public"."enum_tech_tour_events_status";`)
}
