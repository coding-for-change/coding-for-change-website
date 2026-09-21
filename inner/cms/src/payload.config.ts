import path from 'path';
import { fileURLToPath } from 'url';
import { buildConfig, type Field } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder';
import { mcpPlugin } from '@payloadcms/plugin-mcp';
import { resendAdapter } from '@payloadcms/email-resend';
import { Team } from './collections/Team';
import { TeamGroups } from './collections/TeamGroups';
import { Projects } from './collections/Projects';
import { Events } from './collections/Events';
import { FAQ } from './collections/FAQ';
import { Sponsors } from './collections/Sponsors';
import { SponsorTiers } from './collections/SponsorTiers';
import { Companies } from './collections/Companies';
import { Media } from './collections/Media';
import { Users } from './collections/Users';
import { BlogPost } from './collections/BlogPost';
import { WaitlistSignups } from './collections/WaitlistSignups';
import { AnalyticsEvents } from './collections/AnalyticsEvents';
import { ConsentRecords } from './collections/ConsentRecords';
import { ApplicantFiles } from './collections/ApplicantFiles';
import { attributionField } from './fields/attribution';
import { reviewFields } from './fields/review';
import { submissionsExport } from './endpoints/submissionsExport';
import {
  CheckboxGroupBlock,
  SubformBlock,
  UploadBlock,
  submissionFilesField,
} from './lib/formBlocks';
import { purgeOrphanApplicantFiles } from './lib/purgeApplicantFiles';
import { analyticsExportEndpoints } from './endpoints/analyticsExport';
import { analyticsSummary } from './endpoints/analyticsSummary';
import { waitlistEmailEndpoints } from './endpoints/waitlistEmail';
import { purgeAnalyticsEvents } from './lib/purgeAnalytics';
import { SiteConfig } from './globals/SiteConfig';
import { Membership } from './globals/Membership';
import { Legal } from './globals/Legal';
import { Partner } from './globals/Partner';
import { About } from './globals/About';
import { Homepage } from './globals/Homepage';
import { TechTour } from './globals/TechTour';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** Keep the applicant's answers as sent: only the review fields are editable. */
const readOnlyInAdmin = (field: Field): Field =>
  'name' in field && (field.name === 'form' || field.name === 'submissionData')
    ? ({ ...field, admin: { ...(field.admin ?? {}), readOnly: true } } as Field)
    : field;

/** The same field with whatever `admin.width` it carried taken off. */
const fullWidth = (field: Field): Field => {
  if (!('admin' in field) || !field.admin) return field;
  const { width: _column, ...admin } = field.admin as { width?: string };
  return { ...field, admin } as Field;
};

/**
 * Take "Field Width (percentage)" back out of the form builder.
 *
 * It ships with the plugin's stock question blocks, but the site lays forms
 * out itself (`components/forms/CmsForm.tsx`) and has never read the value —
 * so it is a box that asks an editor to make a decision the page then ignores.
 * Our own blocks (lib/formBlocks.ts) do not offer it either.
 *
 * A row left holding a single question setting would keep that setting in a
 * half-width column, so it is unwrapped back to full width; a row left empty
 * goes altogether.
 */
const withoutWidthSetting = (fields: Field[]): Field[] =>
  fields
    .filter((field) => !('name' in field && field.name === 'width'))
    .map((field) => {
      if (field.type !== 'row') return field;
      const kept = withoutWidthSetting(field.fields);
      return kept.length === 1 ? fullWidth(kept[0]) : ({ ...field, fields: kept } as Field);
    })
    .filter((field) => field.type !== 'row' || field.fields.length > 0);

/** `withoutWidthSetting` applied to every question block of a form. */
const questionsWithoutWidth = (field: Field): Field =>
  field.type === 'blocks' && field.name === 'fields'
    ? ({
        ...field,
        blocks: field.blocks.map((block) => ({
          ...block,
          fields: withoutWidthSetting(block.fields),
        })),
      } as Field)
    : field;

export default buildConfig({
  editor: lexicalEditor(),
  collections: [Users, Team, TeamGroups, Projects, Events, FAQ, Sponsors, SponsorTiers, Companies, Media, BlogPost, WaitlistSignups, AnalyticsEvents, ConsentRecords, ApplicantFiles],
  globals: [SiteConfig, Membership, Legal, Partner, About, Homepage, TechTour],
  // Admin-only analytics reporting: JSON aggregates for the /admin/analytics
  // dashboard, plus CSV exports (campaign funnel, raw events, signups) and
  // the bulk "email the waitlist" sender (individual mails via Resend).
  endpoints: [analyticsSummary, ...analyticsExportEndpoints, ...waitlistEmailEndpoints, submissionsExport],
  localization: {
    locales: [
      { label: 'English', code: 'en' },
      { label: 'Deutsch', code: 'de' },
    ],
    defaultLocale: 'en',
    fallback: true,
  },
  secret: process.env.PAYLOAD_SECRET || 'CHANGE-ME',
  // Resend transactional email. Only wired up when a key is present, so local
  // dev still boots without one (Payload logs emails to the console instead).
  email: process.env.RESEND_API_KEY
    ? resendAdapter({
        apiKey: process.env.RESEND_API_KEY,
        defaultFromAddress:
          process.env.EMAIL_FROM || 'noreply@codingforchange.com',
        defaultFromName: process.env.EMAIL_FROM_NAME || 'Coding for Change',
      })
    : undefined,
  plugins: [
    // Contact (and any future) forms are defined in the admin panel and stored
    // in the `forms` / `form-submissions` collections. The inner site fetches
    // the schema and POSTs submissions to /api/form-submissions.
    formBuilderPlugin({
      fields: {
        text: true,
        textarea: true,
        email: true,
        number: true,
        select: true,
        checkbox: true,
        message: true,
        // Our own blocks (see lib/formBlocks.ts): a private PDF upload for
        // CVs, a multi-select checkbox group, and a "linked form" checkbox
        // that reveals another form's questions inline.
        upload: UploadBlock,
        checkboxGroup: CheckboxGroupBlock,
        subform: SubformBlock,
        // Not needed for our forms — keep the builder UI focused.
        country: false,
        state: false,
        date: false,
        payment: false,
      },
      // Fallback recipient when a form doesn't define its own emails.
      defaultToEmail:
        process.env.CONTACT_TO_EMAIL || 'info@codingforchange.com',
      // Every setting the admin offers has to be one the site honours.
      // Two of the plugin's defaults are not: the per-question width (see
      // `withoutWidthSetting`), and "redirect to a page after submit" —
      // CmsForm always shows the confirmation message, so picking Redirect
      // leaves a form that appears to do nothing once it is sent.
      formOverrides: {
        fields: ({ defaultFields }) =>
          defaultFields
            .filter(
              (field) =>
                !(
                  'name' in field &&
                  (field.name === 'confirmationType' || field.name === 'redirect')
                )
            )
            .map((field) => {
              // The confirmation message was only shown while confirmationType
              // was "message"; with the choice gone that condition would hide
              // it for good.
              if ('name' in field && field.name === 'confirmationMessage') {
                const { condition: _always, ...admin } = field.admin ?? {};
                return { ...field, admin } as Field;
              }
              return field;
            })
            .map(questionsWithoutWidth),
      },
      // Submissions get: the reviewer's status + notes (sidebar), the answers
      // (read-only in the admin — what the applicant sent stays as sent), the
      // documents (CV) uploaded to `applicant-files`, and the campaign /
      // traffic-source attribution (same shared field as WaitlistSignups) so
      // conversions can be attributed to the poster or link a visitor came from.
      formSubmissionOverrides: {
        fields: ({ defaultFields }) => [
          ...reviewFields,
          ...defaultFields.map(readOnlyInAdmin),
          submissionFilesField,
          attributionField,
        ],
        // The plugin forbids updates; admins need them for the review fields.
        access: {
          update: ({ req: { user } }) => Boolean(user),
        },
        admin: {
          defaultColumns: ['form', 'reviewStatus', 'createdAt'],
          components: {
            // "Download as Excel" — one .xlsx per form (see endpoints/submissionsExport.ts).
            beforeListTable: ['/components/submissions/ExportSubmissions#ExportSubmissions'],
          },
        },
      },
    }),
    // Model Context Protocol server at /api/mcp. Full CRUD on content is exposed
    // here, but every request still needs a Bearer API key (managed in the
    // admin "MCP API Keys" collection) whose per-capability access can be
    // narrowed there. Declared after formBuilderPlugin so it can see the
    // forms / form-submissions collections.
    mcpPlugin({
      collections: {
        team: { enabled: true },
        projects: { enabled: true },
        events: { enabled: true },
        faq: { enabled: true },
        sponsors: { enabled: true },
        'sponsor-tiers': { enabled: true },
        companies: { enabled: true },
        media: { enabled: true },
        'blog-posts': { enabled: true },
        forms: { enabled: true },
        'form-submissions': { enabled: true },
      },
      globals: {
        'site-config': { enabled: true },
        membership: { enabled: true },
        legal: { enabled: true },
        partner: { enabled: true },
        about: { enabled: true },
        homepage: { enabled: true },
        'tech-tour': { enabled: true },
      },
    }),
  ],
  db: postgresAdapter({
    // push:true is Drizzle's schema-push — dev convenience only.
    // In production NODE_ENV is 'production' (set by next build), so this is false
    // and the Dockerfile runs `payload migrate` instead before starting.
    push: process.env.NODE_ENV !== 'production',
    pool: {
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://payload:payload@localhost:5432/payload',
    },
  }),
  admin: {
    user: 'users',
    meta: {
      titleSuffix: '— Coding for Change CMS',
    },
    // Custom component paths ('/components/…') resolve against src/, not cwd.
    importMap: {
      baseDir: dirname,
    },
    components: {
      views: {
        // First-party analytics dashboard (charts over analytics-events).
        // The view guards auth itself — root custom views are public by default.
        analyticsDashboard: {
          Component:
            '/components/analytics/AnalyticsDashboardView#AnalyticsDashboardView',
          path: '/analytics',
          exact: true,
        },
      },
      afterNavLinks: ['/components/analytics/AnalyticsNavLink#AnalyticsNavLink'],
    },
  },
  // Enforce the analytics retention window (GDPR storage limitation): purge
  // old behavioural events once at startup, then daily while the server runs.
  // The same schedule removes applicant uploads that never made it onto a
  // submission. Failures are logged, never fatal; the interval is unref'd so
  // it never holds a build/CLI process open.
  onInit: async (payload) => {
    const run = async () => {
      await purgeAnalyticsEvents(payload).catch((err) =>
        payload.logger.error(err, '[analytics] retention purge failed'),
      );
      await purgeOrphanApplicantFiles(payload).catch((err) =>
        payload.logger.error(err, '[applicant-files] orphan purge failed'),
      );
    };
    await run();
    const timer = setInterval(run, 24 * 60 * 60 * 1000);
    (timer as { unref?: () => void }).unref?.();
  },
  typescript: {
    outputFile: './src/payload-types.ts',
  },
});
