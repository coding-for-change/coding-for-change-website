import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "projects_press" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"outlet" varchar NOT NULL,
  	"headline" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"date" timestamp(3) with time zone,
  	"logo_id" integer
  );
  
  ALTER TABLE "projects_press" ADD CONSTRAINT "projects_press_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects_press" ADD CONSTRAINT "projects_press_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_press_order_idx" ON "projects_press" USING btree ("_order");
  CREATE INDEX "projects_press_parent_id_idx" ON "projects_press" USING btree ("_parent_id");
  CREATE INDEX "projects_press_logo_idx" ON "projects_press" USING btree ("logo_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "projects_press" CASCADE;`)
}
