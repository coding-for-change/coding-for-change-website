import * as migration_20260604_112404_initial from './20260604_112404_initial';
import * as migration_20260604_120028_add_blog_posts from './20260604_120028_add_blog_posts';
import * as migration_20260604_123322_add_forms_and_mcp from './20260604_123322_add_forms_and_mcp';
import * as migration_20260604_154011_add_site_config_stats from './20260604_154011_add_site_config_stats';
import * as migration_20260604_154226_add_companies from './20260604_154226_add_companies';
import * as migration_20260608_205054_advisers_companies_booking from './20260608_205054_advisers_companies_booking';
import * as migration_20260610_193625_team_orderable from './20260610_193625_team_orderable';
import * as migration_20260706_221019_add_waitlist_signups from './20260706_221019_add_waitlist_signups';
import * as migration_20260706_222240_add_membership_tracks from './20260706_222240_add_membership_tracks';
import * as migration_20260709_090217_add_attribution_fields from './20260709_090217_add_attribution_fields';
import * as migration_20260709_092056_add_analytics_events from './20260709_092056_add_analytics_events';
import * as migration_20260712_090410_add_case_study_and_partner from './20260712_090410_add_case_study_and_partner';
import * as migration_20260712_130720_add_platinum_sponsor_tier from './20260712_130720_add_platinum_sponsor_tier';
import * as migration_20260712_132402_add_impact_story_fields from './20260712_132402_add_impact_story_fields';
import * as migration_20260712_140635_add_about_homepage_globals from './20260712_140635_add_about_homepage_globals';
import * as migration_20260712_141559_add_sponsor_tiers_collection from './20260712_141559_add_sponsor_tiers_collection';
import * as migration_20260712_184709_add_media_fields from './20260712_184709_add_media_fields';
import * as migration_20260712_214450_add_team_groups from './20260712_214450_add_team_groups';
import * as migration_20260719_183539_add_case_study_elements from './20260719_183539_add_case_study_elements';
import * as migration_20260719_205115_add_case_study_content_blocks from './20260719_205115_add_case_study_content_blocks';
import * as migration_20260720_103819_add_color_mode from './20260720_103819_add_color_mode';
import * as migration_20260727_093224_add_consent_records_and_visitor_id from './20260727_093224_add_consent_records_and_visitor_id';
import * as migration_20260727_140356_drop_attribution_visitor_id from './20260727_140356_drop_attribution_visitor_id';
import * as migration_20260819_132939_add_demo_block_and_gallery_layout from './20260819_132939_add_demo_block_and_gallery_layout';
import * as migration_20260819_170710_drop_demo_embed_url from './20260819_170710_drop_demo_embed_url';
import * as migration_20260827_113402_process_timeline_fields from './20260827_113402_process_timeline_fields';
import * as migration_20260828_153051_add_site_config_member_count from './20260828_153051_add_site_config_member_count';
import * as migration_20260829_104650_add_project_team from './20260829_104650_add_project_team';
import * as migration_20260913_114726_techtour_forms_and_applicant_files from './20260913_114726_techtour_forms_and_applicant_files';
import * as migration_20260913_131103_add_submission_review from './20260913_131103_add_submission_review';
import * as migration_20260913_153347_add_techtour_visibility from './20260913_153347_add_techtour_visibility';
import * as migration_20260919_120100_techtour_event_image from './20260919_120100_techtour_event_image';

export const migrations = [
  {
    up: migration_20260604_112404_initial.up,
    down: migration_20260604_112404_initial.down,
    name: '20260604_112404_initial',
  },
  {
    up: migration_20260604_120028_add_blog_posts.up,
    down: migration_20260604_120028_add_blog_posts.down,
    name: '20260604_120028_add_blog_posts',
  },
  {
    up: migration_20260604_123322_add_forms_and_mcp.up,
    down: migration_20260604_123322_add_forms_and_mcp.down,
    name: '20260604_123322_add_forms_and_mcp',
  },
  {
    up: migration_20260604_154011_add_site_config_stats.up,
    down: migration_20260604_154011_add_site_config_stats.down,
    name: '20260604_154011_add_site_config_stats',
  },
  {
    up: migration_20260604_154226_add_companies.up,
    down: migration_20260604_154226_add_companies.down,
    name: '20260604_154226_add_companies',
  },
  {
    up: migration_20260608_205054_advisers_companies_booking.up,
    down: migration_20260608_205054_advisers_companies_booking.down,
    name: '20260608_205054_advisers_companies_booking',
  },
  {
    up: migration_20260610_193625_team_orderable.up,
    down: migration_20260610_193625_team_orderable.down,
    name: '20260610_193625_team_orderable',
  },
  {
    up: migration_20260706_221019_add_waitlist_signups.up,
    down: migration_20260706_221019_add_waitlist_signups.down,
    name: '20260706_221019_add_waitlist_signups',
  },
  {
    up: migration_20260706_222240_add_membership_tracks.up,
    down: migration_20260706_222240_add_membership_tracks.down,
    name: '20260706_222240_add_membership_tracks',
  },
  {
    up: migration_20260709_090217_add_attribution_fields.up,
    down: migration_20260709_090217_add_attribution_fields.down,
    name: '20260709_090217_add_attribution_fields',
  },
  {
    up: migration_20260709_092056_add_analytics_events.up,
    down: migration_20260709_092056_add_analytics_events.down,
    name: '20260709_092056_add_analytics_events',
  },
  {
    up: migration_20260712_090410_add_case_study_and_partner.up,
    down: migration_20260712_090410_add_case_study_and_partner.down,
    name: '20260712_090410_add_case_study_and_partner',
  },
  {
    up: migration_20260712_130720_add_platinum_sponsor_tier.up,
    down: migration_20260712_130720_add_platinum_sponsor_tier.down,
    name: '20260712_130720_add_platinum_sponsor_tier',
  },
  {
    up: migration_20260712_132402_add_impact_story_fields.up,
    down: migration_20260712_132402_add_impact_story_fields.down,
    name: '20260712_132402_add_impact_story_fields',
  },
  {
    up: migration_20260712_140635_add_about_homepage_globals.up,
    down: migration_20260712_140635_add_about_homepage_globals.down,
    name: '20260712_140635_add_about_homepage_globals',
  },
  {
    up: migration_20260712_141559_add_sponsor_tiers_collection.up,
    down: migration_20260712_141559_add_sponsor_tiers_collection.down,
    name: '20260712_141559_add_sponsor_tiers_collection',
  },
  {
    up: migration_20260712_184709_add_media_fields.up,
    down: migration_20260712_184709_add_media_fields.down,
    name: '20260712_184709_add_media_fields',
  },
  {
    up: migration_20260712_214450_add_team_groups.up,
    down: migration_20260712_214450_add_team_groups.down,
    name: '20260712_214450_add_team_groups',
  },
  {
    up: migration_20260719_183539_add_case_study_elements.up,
    down: migration_20260719_183539_add_case_study_elements.down,
    name: '20260719_183539_add_case_study_elements',
  },
  {
    up: migration_20260719_205115_add_case_study_content_blocks.up,
    down: migration_20260719_205115_add_case_study_content_blocks.down,
    name: '20260719_205115_add_case_study_content_blocks',
  },
  {
    up: migration_20260720_103819_add_color_mode.up,
    down: migration_20260720_103819_add_color_mode.down,
    name: '20260720_103819_add_color_mode',
  },
  {
    up: migration_20260727_093224_add_consent_records_and_visitor_id.up,
    down: migration_20260727_093224_add_consent_records_and_visitor_id.down,
    name: '20260727_093224_add_consent_records_and_visitor_id',
  },
  {
    up: migration_20260727_140356_drop_attribution_visitor_id.up,
    down: migration_20260727_140356_drop_attribution_visitor_id.down,
    name: '20260727_140356_drop_attribution_visitor_id',
  },
  {
    up: migration_20260819_132939_add_demo_block_and_gallery_layout.up,
    down: migration_20260819_132939_add_demo_block_and_gallery_layout.down,
    name: '20260819_132939_add_demo_block_and_gallery_layout',
  },
  {
    up: migration_20260819_170710_drop_demo_embed_url.up,
    down: migration_20260819_170710_drop_demo_embed_url.down,
    name: '20260819_170710_drop_demo_embed_url',
  },
  {
    up: migration_20260827_113402_process_timeline_fields.up,
    down: migration_20260827_113402_process_timeline_fields.down,
    name: '20260827_113402_process_timeline_fields',
  },
  {
    up: migration_20260828_153051_add_site_config_member_count.up,
    down: migration_20260828_153051_add_site_config_member_count.down,
    name: '20260828_153051_add_site_config_member_count',
  },
  {
    up: migration_20260829_104650_add_project_team.up,
    down: migration_20260829_104650_add_project_team.down,
    name: '20260829_104650_add_project_team',
  },
  {
    up: migration_20260913_114726_techtour_forms_and_applicant_files.up,
    down: migration_20260913_114726_techtour_forms_and_applicant_files.down,
    name: '20260913_114726_techtour_forms_and_applicant_files',
  },
  {
    up: migration_20260913_131103_add_submission_review.up,
    down: migration_20260913_131103_add_submission_review.down,
    name: '20260913_131103_add_submission_review',
  },
  {
    up: migration_20260913_153347_add_techtour_visibility.up,
    down: migration_20260913_153347_add_techtour_visibility.down,
    name: '20260913_153347_add_techtour_visibility',
  },
  {
    up: migration_20260919_120100_techtour_event_image.up,
    down: migration_20260919_120100_techtour_event_image.down,
    name: '20260919_120100_techtour_event_image'
  },
];
