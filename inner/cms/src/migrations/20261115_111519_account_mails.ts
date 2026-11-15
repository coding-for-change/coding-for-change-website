import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "account_mailed_at" timestamp(3) with time zone;
  ALTER TABLE "onboarding" ADD COLUMN "account_mail_subject" varchar;
  ALTER TABLE "onboarding" ADD COLUMN "account_mail_message" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "account_mailed_at";
  ALTER TABLE "onboarding" DROP COLUMN "account_mail_subject";
  ALTER TABLE "onboarding" DROP COLUMN "account_mail_message";`)
}
