import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "onboarding_member_todos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_url" varchar
  );
  
  CREATE TABLE "onboarding_member_todos_locales" (
  	"text" varchar NOT NULL,
  	"link_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "onboarding_board_todos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL,
  	"link_url" varchar,
  	"link_label" varchar
  );
  
  CREATE TABLE "onboarding_document_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"docuseal_template_id" numeric NOT NULL
  );
  
  CREATE TABLE "onboarding_document_items_locales" (
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "onboarding" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"form_id" integer,
  	"google_org_unit_path" varchar DEFAULT '/',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "onboarding_locales" (
  	"intro" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "onboarding_checks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"kind" varchar NOT NULL,
  	"item_id" varchar NOT NULL,
  	"text" varchar NOT NULL,
  	"link_url" varchar,
  	"done" boolean NOT NULL,
  	"done_by" varchar NOT NULL,
  	"locale" varchar,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "onboarding_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"item_id" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"docuseal_template_id" integer NOT NULL,
  	"docuseal_submission_id" integer NOT NULL,
  	"docuseal_submitter_slug" varchar NOT NULL,
  	"status" varchar DEFAULT 'pending' NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"completed_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "team" ADD COLUMN "published" boolean DEFAULT true;
  -- Every profile on the site today stays on it (the column's default fills them; said out loud here).
  UPDATE "team" SET "published" = true WHERE "published" IS NULL;
  ALTER TABLE "forms" ADD COLUMN "requires_login" boolean DEFAULT false;
  ALTER TABLE "form_submissions" ADD COLUMN "submitted_by_id" integer;
  ALTER TABLE "users" ADD COLUMN "first_name" varchar;
  ALTER TABLE "users" ADD COLUMN "last_name" varchar;
  ALTER TABLE "users" ADD COLUMN "private_email" varchar;
  ALTER TABLE "users" ADD COLUMN "github_username" varchar;
  ALTER TABLE "users" ADD COLUMN "application_id" integer;
  ALTER TABLE "users" ADD COLUMN "team_profile_id" integer;
  ALTER TABLE "users" ADD COLUMN "account_exported_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "signed_in_at" timestamp(3) with time zone;
  ALTER TABLE "onboarding_member_todos" ADD CONSTRAINT "onboarding_member_todos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."onboarding"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "onboarding_member_todos_locales" ADD CONSTRAINT "onboarding_member_todos_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."onboarding_member_todos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "onboarding_board_todos" ADD CONSTRAINT "onboarding_board_todos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."onboarding"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "onboarding_document_items" ADD CONSTRAINT "onboarding_document_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."onboarding"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "onboarding_document_items_locales" ADD CONSTRAINT "onboarding_document_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."onboarding_document_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "onboarding" ADD CONSTRAINT "onboarding_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "onboarding_locales" ADD CONSTRAINT "onboarding_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."onboarding"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "onboarding_checks" ADD CONSTRAINT "onboarding_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "onboarding_documents" ADD CONSTRAINT "onboarding_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "onboarding_member_todos_order_idx" ON "onboarding_member_todos" USING btree ("_order");
  CREATE INDEX "onboarding_member_todos_parent_id_idx" ON "onboarding_member_todos" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "onboarding_member_todos_locales_locale_parent_id_unique" ON "onboarding_member_todos_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "onboarding_board_todos_order_idx" ON "onboarding_board_todos" USING btree ("_order");
  CREATE INDEX "onboarding_board_todos_parent_id_idx" ON "onboarding_board_todos" USING btree ("_parent_id");
  CREATE INDEX "onboarding_document_items_order_idx" ON "onboarding_document_items" USING btree ("_order");
  CREATE INDEX "onboarding_document_items_parent_id_idx" ON "onboarding_document_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "onboarding_document_items_locales_locale_parent_id_unique" ON "onboarding_document_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "onboarding_form_idx" ON "onboarding" USING btree ("form_id");
  CREATE UNIQUE INDEX "onboarding_locales_locale_parent_id_unique" ON "onboarding_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "onboarding_checks_user_kind_item_idx" ON "onboarding_checks" USING btree ("user_id","kind","item_id");
  CREATE INDEX "onboarding_documents_user_item_idx" ON "onboarding_documents" USING btree ("user_id","item_id");
  CREATE UNIQUE INDEX "onboarding_documents_submission_idx" ON "onboarding_documents" USING btree ("docuseal_submission_id");
  ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_application_id_form_submissions_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."form_submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_team_profile_id_team_id_fk" FOREIGN KEY ("team_profile_id") REFERENCES "public"."team"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "form_submissions_submitted_by_idx" ON "form_submissions" USING btree ("submitted_by_id");
  CREATE UNIQUE INDEX "users_application_idx" ON "users" USING btree ("application_id");
  CREATE INDEX "users_team_profile_idx" ON "users" USING btree ("team_profile_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "onboarding_member_todos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "onboarding_member_todos_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "onboarding_board_todos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "onboarding_document_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "onboarding_document_items_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "onboarding" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "onboarding_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "onboarding_checks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "onboarding_documents" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "onboarding_member_todos" CASCADE;
  DROP TABLE "onboarding_member_todos_locales" CASCADE;
  DROP TABLE "onboarding_board_todos" CASCADE;
  DROP TABLE "onboarding_document_items" CASCADE;
  DROP TABLE "onboarding_document_items_locales" CASCADE;
  DROP TABLE "onboarding" CASCADE;
  DROP TABLE "onboarding_locales" CASCADE;
  DROP TABLE "onboarding_checks" CASCADE;
  DROP TABLE "onboarding_documents" CASCADE;
  ALTER TABLE "form_submissions" DROP CONSTRAINT "form_submissions_submitted_by_id_users_id_fk";
  
  ALTER TABLE "users" DROP CONSTRAINT "users_application_id_form_submissions_id_fk";
  
  ALTER TABLE "users" DROP CONSTRAINT "users_team_profile_id_team_id_fk";
  
  DROP INDEX "form_submissions_submitted_by_idx";
  DROP INDEX "users_application_idx";
  DROP INDEX "users_team_profile_idx";
  ALTER TABLE "team" DROP COLUMN "published";
  ALTER TABLE "forms" DROP COLUMN "requires_login";
  ALTER TABLE "form_submissions" DROP COLUMN "submitted_by_id";
  ALTER TABLE "users" DROP COLUMN "first_name";
  ALTER TABLE "users" DROP COLUMN "last_name";
  ALTER TABLE "users" DROP COLUMN "private_email";
  ALTER TABLE "users" DROP COLUMN "github_username";
  ALTER TABLE "users" DROP COLUMN "application_id";
  ALTER TABLE "users" DROP COLUMN "team_profile_id";
  ALTER TABLE "users" DROP COLUMN "account_exported_at";
  ALTER TABLE "users" DROP COLUMN "signed_in_at";`)
}
