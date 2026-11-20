import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_forms_blocks_upload_accept" AS ENUM('pdf', 'image');
  ALTER TABLE "media" ADD COLUMN "private" boolean DEFAULT false;
  ALTER TABLE "media" ADD COLUMN "uploaded_by_id" integer;
  ALTER TABLE "forms_blocks_upload" ADD COLUMN "accept" "enum_forms_blocks_upload_accept" DEFAULT 'pdf' NOT NULL;
  ALTER TABLE "users" ADD COLUMN "steps_completed_at" timestamp(3) with time zone;
  ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "media_uploaded_by_idx" ON "media" USING btree ("uploaded_by_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" DROP CONSTRAINT "media_uploaded_by_id_users_id_fk";
  
  DROP INDEX "media_uploaded_by_idx";
  ALTER TABLE "media" DROP COLUMN "private";
  ALTER TABLE "media" DROP COLUMN "uploaded_by_id";
  ALTER TABLE "forms_blocks_upload" DROP COLUMN "accept";
  ALTER TABLE "users" DROP COLUMN "steps_completed_at";
  DROP TYPE "public"."enum_forms_blocks_upload_accept";`)
}
