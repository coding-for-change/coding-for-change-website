import type { Field, GlobalConfig } from 'payload';
import { DEFAULT_ACCOUNT_MAIL_MESSAGE, DEFAULT_ACCOUNT_MAIL_SUBJECT, templateProblem } from '../lib/onboarding/accountMail';
import { hasAdminRole, isAdmin, roleOf } from '../access/roles';

/**
 * What the onboarding of a new member consists of: the board's dashboard
 * (/admin/onboarding, endpoints/onboarding.ts) and the member's own page
 * (/onboarding) both read it.
 *
 * Read by any signed-in account (members need it for their page) but never
 * anonymously: it holds internal links. Changed by admins only. Not exposed
 * through the MCP connector.
 *
 * To-dos and documents are matched by their row id, so ticks and signatures
 * stay with a to-do when the list is reordered. Changing a to-do's wording
 * keeps who ticked it (the row keeps the wording they saw); for a new
 * requirement add a new to-do instead.
 */

const linkFields = (localized: boolean): Field => ({
  type: 'row',
  fields: [
    {
      name: 'linkUrl',
      type: 'text',
      label: 'Link',
      admin: {
        width: '50%',
        description: 'Optional: https://… or a path on our site such as /join. Opens in a new tab.',
      },
    },
    {
      name: 'linkLabel',
      type: 'text',
      label: 'Link text',
      localized,
      admin: { width: '50%', description: 'Empty = "Open link".' },
    },
  ],
});

export const Onboarding: GlobalConfig = {
  slug: 'onboarding',
  label: 'Onboarding Settings',
  access: {
    read: ({ req }) => roleOf(req.user) !== null,
    update: isAdmin,
  },
  admin: {
    hidden: ({ user }) => !hasAdminRole(user),
    description:
      'What new members go through after the board admits them: the form, their to-dos and the documents on their onboarding page, and the board\'s own to-dos in the Onboarding dashboard.',
  },
  fields: [
    {
      name: 'intro',
      type: 'textarea',
      localized: true,
      admin: { description: 'Shown at the top of the member\'s onboarding page. Plain text; a blank line starts a new paragraph.' },
    },
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'forms',
      admin: {
        description:
          'The one form every new member fills in on their page (Forms; tick "Requires sign-in" there). Answers to questions named displayName, bio, linkedin, githubUsername, photo (a "Photo" upload) and profilePublic (a checkbox: consent to a public profile) are copied to the member\'s account and team profile. With profilePublic ticked the member gets an unpublished team profile (name, bio, photo, LinkedIn and GitHub links) for the board to publish; without it none, and their photo is deleted. Sending it again updates that profile and unpublishes it until the board publishes it again.',
      },
    },
    {
      name: 'memberTodos',
      label: 'To-dos for the member',
      labels: { singular: 'To-do', plural: 'To-dos' },
      type: 'array',
      admin: {
        initCollapsed: true,
        description:
          'Tick boxes on the member\'s page, e.g. "Join the Slack workspace". Ticking is recorded with the time and the wording shown. Fix typos here; for anything else add a new to-do.',
      },
      fields: [{ name: 'text', type: 'textarea', required: true, localized: true }, linkFields(true)],
    },
    {
      name: 'boardTodos',
      label: 'To-dos for the board',
      labels: { singular: 'To-do', plural: 'To-dos' },
      type: 'array',
      admin: {
        initCollapsed: true,
        description:
          'Ticked by the board per member in the Onboarding dashboard, e.g. "Add to the GitHub organisation" or "Add to the members@ Google group". Members do not see these.',
      },
      fields: [{ name: 'text', type: 'textarea', required: true }, linkFields(false)],
    },
    {
      name: 'documents',
      labels: { singular: 'Document', plural: 'Documents' },
      type: 'array',
      // Payload would call this array's table `onboarding_documents`, the
      // name of the plain table of started DocuSeal documents
      // (lib/onboarding/tables.ts).
      dbName: 'onboarding_document_items',
      admin: {
        initCollapsed: true,
        description: 'Documents every new member signs through DocuSeal, e.g. the membership declaration.',
      },
      fields: [
        { name: 'title', type: 'text', required: true, localized: true },
        {
          name: 'description',
          type: 'textarea',
          localized: true,
          admin: { description: 'Optional: one or two sentences on the member\'s page about what this is.' },
        },
        {
          name: 'docusealTemplateId',
          label: 'DocuSeal template ID',
          type: 'number',
          required: true,
          admin: { description: 'The number in the template\'s address in DocuSeal (…/templates/<ID>).' },
        },
      ],
    },
    {
      name: 'googleOrgUnitPath',
      label: 'Google org unit',
      type: 'text',
      defaultValue: '/',
      admin: {
        description:
          'Where new accounts go in Google Admin, e.g. "/" or "/Members". Written into the CSV the dashboard downloads.',
      },
      validate: (value: unknown) =>
        value == null || value === '' || (typeof value === 'string' && value.startsWith('/'))
          ? true
          : 'Starts with "/", e.g. "/Members".',
    },
    {
      type: 'collapsible',
      label: 'Mail with the sign-in details',
      admin: {
        initCollapsed: true,
        description:
          'Sent from the Onboarding dashboard ("Email sign-in details") to each new member\'s private address, when the password sheets were not handed over in person. Placeholders: {{firstName}}, {{lastName}}, {{email}} (the association address), {{password}}, {{onboardingUrl}}. Leave a field empty to use the built-in text (German, then English).',
      },
      fields: [
        {
          name: 'accountMailSubject',
          label: 'Subject',
          type: 'text',
          maxLength: 200,
          validate: (value: unknown) => {
            if (typeof value !== 'string' || !value.trim()) return true;
            return templateProblem(value, DEFAULT_ACCOUNT_MAIL_MESSAGE) ?? true;
          },
        },
        {
          name: 'accountMailMessage',
          label: 'Message',
          type: 'textarea',
          maxLength: 10000,
          admin: {
            rows: 18,
            description:
              'Plain text; an empty line starts a new paragraph, links become clickable. It must contain {{password}} and {{email}}. The member\'s password sheet is attached and a button to the onboarding page is added below the text.',
          },
          validate: (value: unknown) => {
            if (typeof value !== 'string' || !value.trim()) return true;
            return templateProblem(DEFAULT_ACCOUNT_MAIL_SUBJECT, value) ?? true;
          },
        },
      ],
    },
  ],
};
