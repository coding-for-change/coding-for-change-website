import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "mailings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"source" varchar NOT NULL,
  	"config" jsonb NOT NULL,
  	"created_by" varchar,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_by" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"sending_since" timestamp(3) with time zone
  );
  
  CREATE TABLE "mailing_sends" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"mailing_id" integer NOT NULL,
  	"sent_by" varchar,
  	"started_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"finished_at" timestamp(3) with time zone,
  	"requested" integer DEFAULT 0 NOT NULL,
  	"sent" integer DEFAULT 0 NOT NULL,
  	"failed" integer DEFAULT 0 NOT NULL,
  	"config" jsonb NOT NULL
  );
  
  CREATE TABLE "mailing_recipients" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"mailing_id" integer NOT NULL,
  	"send_id" integer NOT NULL,
  	"submission_id" integer,
  	"waitlist_signup_id" integer,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"group_id" varchar NOT NULL,
  	"group_label" varchar NOT NULL,
  	"lang" varchar NOT NULL,
  	"subject" varchar NOT NULL,
  	"html" text NOT NULL,
  	"text" text NOT NULL,
  	"status" varchar NOT NULL,
  	"provider_id" varchar,
  	"error" varchar,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"sent_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "mailing_sends" ADD CONSTRAINT "mailing_sends_mailing_id_mailings_id_fk" FOREIGN KEY ("mailing_id") REFERENCES "public"."mailings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mailing_recipients" ADD CONSTRAINT "mailing_recipients_mailing_id_mailings_id_fk" FOREIGN KEY ("mailing_id") REFERENCES "public"."mailings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mailing_recipients" ADD CONSTRAINT "mailing_recipients_send_id_mailing_sends_id_fk" FOREIGN KEY ("send_id") REFERENCES "public"."mailing_sends"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mailing_recipients" ADD CONSTRAINT "mailing_recipients_submission_id_form_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mailing_recipients" ADD CONSTRAINT "mailing_recipients_waitlist_signup_id_waitlist_signups_id_fk" FOREIGN KEY ("waitlist_signup_id") REFERENCES "public"."waitlist_signups"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "mailing_sends_mailing_idx" ON "mailing_sends" USING btree ("mailing_id");
  CREATE INDEX "mailing_recipients_mailing_idx" ON "mailing_recipients" USING btree ("mailing_id");
  CREATE INDEX "mailing_recipients_send_idx" ON "mailing_recipients" USING btree ("send_id");
  CREATE INDEX "mailing_recipients_email_idx" ON "mailing_recipients" USING btree ("email");
  CREATE INDEX "mailing_recipients_submission_idx" ON "mailing_recipients" USING btree ("submission_id");
  CREATE INDEX "mailing_recipients_waitlist_signup_idx" ON "mailing_recipients" USING btree ("waitlist_signup_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "mailings" CASCADE;
  DROP TABLE "mailing_sends" CASCADE;
  DROP TABLE "mailing_recipients" CASCADE;`)
}
