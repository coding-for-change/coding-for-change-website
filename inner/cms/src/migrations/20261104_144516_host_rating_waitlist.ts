import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_share_access_log_action" ADD VALUE 'waitlisted';
  ALTER TYPE "public"."enum_share_access_log_action" ADD VALUE 'rated';
  ALTER TYPE "public"."enum_share_access_log_action" ADD VALUE 'moved';
  CREATE TABLE "techtour_host_scores" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"submission_id" integer NOT NULL,
  	"option" varchar NOT NULL,
  	"score" smallint,
  	"scored_by" varchar NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "techtour_waitlist_order" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"submission_id" integer NOT NULL,
  	"option" varchar NOT NULL,
  	"position" double precision NOT NULL,
  	"moved_by" varchar NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "techtour_waitlist_moves" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"submission_id" integer NOT NULL,
  	"option" varchar NOT NULL,
  	"mail_status" varchar NOT NULL,
  	"mail_error" varchar,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "share_links" ADD COLUMN "rating" boolean DEFAULT false;
  ALTER TABLE "share_links" ADD COLUMN "waitlist" boolean DEFAULT false;
  ALTER TABLE "share_links" ADD COLUMN "waitlist_until" timestamp(3) with time zone;
  ALTER TABLE "techtour_host_scores" ADD CONSTRAINT "techtour_host_scores_submission_id_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "techtour_waitlist_order" ADD CONSTRAINT "techtour_waitlist_order_submission_id_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "techtour_waitlist_moves" ADD CONSTRAINT "techtour_waitlist_moves_submission_id_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "techtour_host_scores_submission_idx" ON "techtour_host_scores" USING btree ("submission_id");
  CREATE INDEX "techtour_waitlist_order_submission_idx" ON "techtour_waitlist_order" USING btree ("submission_id");
  CREATE INDEX "techtour_waitlist_moves_submission_idx" ON "techtour_waitlist_moves" USING btree ("submission_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "techtour_host_scores" CASCADE;
  DROP TABLE "techtour_waitlist_order" CASCADE;
  DROP TABLE "techtour_waitlist_moves" CASCADE;
  ALTER TABLE "share_access_log" ALTER COLUMN "action" SET DATA TYPE text;
  DROP TYPE "public"."enum_share_access_log_action";
  CREATE TYPE "public"."enum_share_access_log_action" AS ENUM('code', 'sign-in', 'cv', 'admitted', 'declined', 'undone', 'sign-out');
  ALTER TABLE "share_access_log" ALTER COLUMN "action" SET DATA TYPE "public"."enum_share_access_log_action" USING "action"::"public"."enum_share_access_log_action";
  ALTER TABLE "share_links" DROP COLUMN "rating";
  ALTER TABLE "share_links" DROP COLUMN "waitlist";
  ALTER TABLE "share_links" DROP COLUMN "waitlist_until";`)
}
