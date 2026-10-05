import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_share_access_log_action" AS ENUM('code', 'sign-in', 'cv', 'admitted', 'declined', 'undone', 'sign-out');
  CREATE TABLE "share_links_recipients" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "share_links" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"option" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone,
  	"blocked" boolean DEFAULT false,
  	"form_id" integer,
  	"token" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "share_access_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_id" integer,
  	"email" varchar,
  	"action" "enum_share_access_log_action",
  	"submission" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "form_submissions" ADD COLUMN "host_decisions" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "share_links_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "share_access_log_id" integer;
  ALTER TABLE "share_links_recipients" ADD CONSTRAINT "share_links_recipients_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "share_links" ADD CONSTRAINT "share_links_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "share_access_log" ADD CONSTRAINT "share_access_log_link_id_share_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."share_links"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "share_links_recipients_order_idx" ON "share_links_recipients" USING btree ("_order");
  CREATE INDEX "share_links_recipients_parent_id_idx" ON "share_links_recipients" USING btree ("_parent_id");
  CREATE INDEX "share_links_form_idx" ON "share_links" USING btree ("form_id");
  CREATE UNIQUE INDEX "share_links_token_idx" ON "share_links" USING btree ("token");
  CREATE INDEX "share_links_updated_at_idx" ON "share_links" USING btree ("updated_at");
  CREATE INDEX "share_links_created_at_idx" ON "share_links" USING btree ("created_at");
  CREATE INDEX "share_access_log_link_idx" ON "share_access_log" USING btree ("link_id");
  CREATE INDEX "share_access_log_updated_at_idx" ON "share_access_log" USING btree ("updated_at");
  CREATE INDEX "share_access_log_created_at_idx" ON "share_access_log" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_share_links_fk" FOREIGN KEY ("share_links_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_share_access_log_fk" FOREIGN KEY ("share_access_log_id") REFERENCES "public"."share_access_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_share_links_id_idx" ON "payload_locked_documents_rels" USING btree ("share_links_id");
  CREATE INDEX "payload_locked_documents_rels_share_access_log_id_idx" ON "payload_locked_documents_rels" USING btree ("share_access_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "share_links_recipients" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "share_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "share_access_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "share_links_recipients" CASCADE;
  DROP TABLE "share_links" CASCADE;
  DROP TABLE "share_access_log" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_share_links_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_share_access_log_fk";
  
  DROP INDEX "payload_locked_documents_rels_share_links_id_idx";
  DROP INDEX "payload_locked_documents_rels_share_access_log_id_idx";
  ALTER TABLE "form_submissions" DROP COLUMN "host_decisions";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "share_links_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "share_access_log_id";
  DROP TYPE "public"."enum_share_access_log_action";`)
}
