import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "team_groups_find" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "team_groups_create" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "team_groups_update" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "team_groups_delete" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "waitlist_signups_find" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "waitlist_signups_create" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "waitlist_signups_update" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "waitlist_signups_delete" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "share_links_find" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "share_links_create" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "share_links_update" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "share_links_delete" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "applicant_files_find" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "consent_records_find" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "share_access_log_find" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "analytics_events_find" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_list_mailings" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_get_mailing" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_get_mailing_sources" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_create_mailing" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_update_mailing" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_delete_mailing" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_check_mailing" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_send_test_mail" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_send_mailing" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_get_sent_mail" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_list_mailed_people" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_get_application_stages" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_set_application_stage" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_get_tech_tour_members" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_set_tech_tour_member" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_get_tech_tour_withdrawals" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_set_tech_tour_withdrawal" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_get_host_marks" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_get_analytics" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_create_applicant_file_download_url" boolean DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "team_groups_find";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "team_groups_create";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "team_groups_update";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "team_groups_delete";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "waitlist_signups_find";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "waitlist_signups_create";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "waitlist_signups_update";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "waitlist_signups_delete";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "share_links_find";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "share_links_create";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "share_links_update";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "share_links_delete";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "applicant_files_find";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "consent_records_find";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "share_access_log_find";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "analytics_events_find";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_list_mailings";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_get_mailing";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_get_mailing_sources";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_create_mailing";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_update_mailing";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_delete_mailing";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_check_mailing";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_send_test_mail";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_send_mailing";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_get_sent_mail";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_list_mailed_people";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_get_application_stages";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_set_application_stage";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_get_tech_tour_members";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_set_tech_tour_member";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_get_tech_tour_withdrawals";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_set_tech_tour_withdrawal";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_get_host_marks";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_get_analytics";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_create_applicant_file_download_url";`)
}
