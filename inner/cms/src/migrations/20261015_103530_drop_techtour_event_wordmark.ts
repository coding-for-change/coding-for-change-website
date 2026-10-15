import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tech_tour_events" DROP CONSTRAINT "tech_tour_events_wordmark_id_media_id_fk";
  
  DROP INDEX "tech_tour_events_wordmark_idx";
  ALTER TABLE "tech_tour_events" DROP COLUMN "wordmark_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tech_tour_events" ADD COLUMN "wordmark_id" integer;
  ALTER TABLE "tech_tour_events" ADD CONSTRAINT "tech_tour_events_wordmark_id_media_id_fk" FOREIGN KEY ("wordmark_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "tech_tour_events_wordmark_idx" ON "tech_tour_events" USING btree ("wordmark_id");`)
}
