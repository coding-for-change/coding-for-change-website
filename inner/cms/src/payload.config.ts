import path from 'path';
import { fileURLToPath } from 'url';
import { buildConfig } from 'payload';
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

export default buildConfig({
  editor: lexicalEditor(),
  collections: [Users, Team, TeamGroups, Projects, Events, FAQ, Sponsors, SponsorTiers, Companies, Media, BlogPost, WaitlistSignups, AnalyticsEvents, ConsentRecords, ApplicantFiles],
  globals: [SiteConfig, Membership, Legal, Partner, About, Homepage, TechTour],
  // Admin-only analytics reporting: JSON aggregates for the /admin/analytics
  // dashboard, plus CSV exports (campaign funnel, raw events, signups) and
  // the bulk "email the waitlist" sender (individual mails via Resend).
  endpoints: [analyticsSummary, ...analyticsExportEndpoints, ...waitlistEmailEndpoints],
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
      // Carry campaign/traffic-source attribution onto every form submission
      // (contact + application), so we can attribute conversions to the poster
      // or link a visitor arrived from. Same shared field as WaitlistSignups.
      // …and the documents (CV) uploaded to `applicant-files` for it.
      formSubmissionOverrides: {
        fields: ({ defaultFields }) => [
          ...defaultFields,
          submissionFilesField,
          attributionField,
        ],
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
