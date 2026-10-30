import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "techtour_manage_tokens" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"submission_id" integer NOT NULL,
  	"token" varchar NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "techtour_withdrawals" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"submission_id" integer NOT NULL,
  	"option" varchar NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "techtour_manage_tokens" ADD CONSTRAINT "techtour_manage_tokens_submission_id_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "techtour_withdrawals" ADD CONSTRAINT "techtour_withdrawals_submission_id_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "techtour_manage_tokens_token_idx" ON "techtour_manage_tokens" USING btree ("token");
  CREATE UNIQUE INDEX "techtour_manage_tokens_submission_idx" ON "techtour_manage_tokens" USING btree ("submission_id");
  CREATE UNIQUE INDEX "techtour_withdrawals_submission_option_idx" ON "techtour_withdrawals" USING btree ("submission_id","option");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "techtour_manage_tokens" CASCADE;
  DROP TABLE "techtour_withdrawals" CASCADE;`)
}
