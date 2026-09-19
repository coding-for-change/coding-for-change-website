import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tech_tour_events" ADD COLUMN "image_id" integer;
  ALTER TABLE "tech_tour_events" ADD CONSTRAINT "tech_tour_events_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "tech_tour_events_image_idx" ON "tech_tour_events" USING btree ("image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tech_tour_events" DROP CONSTRAINT "tech_tour_events_image_id_media_id_fk";
  
  DROP INDEX "tech_tour_events_image_idx";
  ALTER TABLE "tech_tour_events" DROP COLUMN "image_id";`)
}
