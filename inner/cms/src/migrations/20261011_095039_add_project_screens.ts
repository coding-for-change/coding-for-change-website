import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "projects" ADD COLUMN "screens_desktop_id" integer;
  ALTER TABLE "projects" ADD COLUMN "screens_mobile_id" integer;
  ALTER TABLE "projects" ADD CONSTRAINT "projects_screens_desktop_id_media_id_fk" FOREIGN KEY ("screens_desktop_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects" ADD CONSTRAINT "projects_screens_mobile_id_media_id_fk" FOREIGN KEY ("screens_mobile_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "projects_screens_screens_desktop_idx" ON "projects" USING btree ("screens_desktop_id");
  CREATE INDEX "projects_screens_screens_mobile_idx" ON "projects" USING btree ("screens_mobile_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "projects" DROP CONSTRAINT "projects_screens_desktop_id_media_id_fk";
  
  ALTER TABLE "projects" DROP CONSTRAINT "projects_screens_mobile_id_media_id_fk";
  
  DROP INDEX "projects_screens_screens_desktop_idx";
  DROP INDEX "projects_screens_screens_mobile_idx";
  ALTER TABLE "projects" DROP COLUMN "screens_desktop_id";
  ALTER TABLE "projects" DROP COLUMN "screens_mobile_id";`)
}
