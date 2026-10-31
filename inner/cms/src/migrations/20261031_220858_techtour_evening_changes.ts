import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "techtour_evening_changes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"submission_id" integer NOT NULL,
  	"option" varchar NOT NULL,
  	"withdrawn" boolean NOT NULL,
  	"changed_by" varchar NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "techtour_evening_changes" ADD CONSTRAINT "techtour_evening_changes_submission_id_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "techtour_evening_changes_submission_idx" ON "techtour_evening_changes" USING btree ("submission_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "techtour_evening_changes" CASCADE;`)
}
