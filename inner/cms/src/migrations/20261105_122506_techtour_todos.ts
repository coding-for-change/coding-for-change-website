import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "tech_tour_events_todos" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_url" varchar
  );
  
  CREATE TABLE "tech_tour_events_todos_locales" (
  	"text" varchar,
  	"link_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "techtour_confirmations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"submission_id" integer NOT NULL,
  	"option" varchar NOT NULL,
  	"todo_id" varchar NOT NULL,
  	"text" varchar NOT NULL,
  	"link_url" varchar,
  	"locale" varchar NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "tech_tour_events_todos" ADD CONSTRAINT "tech_tour_events_todos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tech_tour_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tech_tour_events_todos_locales" ADD CONSTRAINT "tech_tour_events_todos_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tech_tour_events_todos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "techtour_confirmations" ADD CONSTRAINT "techtour_confirmations_submission_id_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "tech_tour_events_todos_order_idx" ON "tech_tour_events_todos" USING btree ("_order");
  CREATE INDEX "tech_tour_events_todos_parent_id_idx" ON "tech_tour_events_todos" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "tech_tour_events_todos_locales_locale_parent_id_unique" ON "tech_tour_events_todos_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "techtour_confirmations_submission_option_todo_idx" ON "techtour_confirmations" USING btree ("submission_id","option","todo_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "tech_tour_events_todos" CASCADE;
  DROP TABLE "tech_tour_events_todos_locales" CASCADE;
  DROP TABLE "techtour_confirmations" CASCADE;`)
}
