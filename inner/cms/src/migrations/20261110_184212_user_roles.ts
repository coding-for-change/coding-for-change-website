import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('member', 'editor', 'admin');
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'member' NOT NULL;`)
  // Everyone with an account today has full access, and the MCP API keys run
  // as their users: anything below admin would lock people out and break the
  // keys. The board narrows roles down afterwards. New accounts start as
  // member (the column default).
  await db.execute(sql`UPDATE "users" SET "role" = 'admin';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "role";
  DROP TYPE "public"."enum_users_role";`)
}
