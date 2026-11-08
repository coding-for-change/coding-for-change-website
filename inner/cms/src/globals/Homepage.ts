import { GlobalConfig } from 'payload';

/**
 * Homepage section copy. Editable in the CMS; the frontend falls back to its
 * built-in (i18n) copy for any field left blank, so an empty global is safe.
 */
export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Homepage',
  access: {
    read: () => true,
  },
  fields: [
    {
      type: 'collapsible',
      label: 'Hero',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'heroCtaPrimary',
          type: 'text',
          localized: true,
          admin: { description: 'The first hero button, to the NGO page ("Start a project").' },
        },
        {
          name: 'heroCtaSecondary',
          type: 'text',
          localized: true,
          admin: { description: 'The second hero button, to the Join page ("Become a member").' },
        },
        {
          name: 'heroImage',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description:
              'The photo behind the hero headline, across the full width – a wide, landscape candid of the club at an event or mid-build, at least 2400 px wide. The headline sits on its lower left, so keep faces out of that corner. Left empty, the built-in event photo is shown.',
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'About section',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'aboutOneLiner',
          type: 'textarea',
          localized: true,
          admin: { description: 'The statement under the logo strip, first part (dark), e.g. "NGOs have the mission."' },
        },
        {
          name: 'aboutPitch',
          type: 'textarea',
          localized: true,
          admin: { description: 'Its continuation (grey).' },
        },
        {
          name: 'steps',
          label: 'Process steps',
          type: 'array',
          admin: {
            description:
              'Overrides the built-in process timeline (homepage and NGO page). Add, remove or reorder steps freely — e.g. drop the MVP step or add an expansion step.',
          },
          fields: [
            {
              name: 'timing',
              type: 'text',
              localized: true,
              admin: { description: 'Small badge above the title (e.g. "Week 0", "≈ 2 weeks in").' },
            },
            { name: 'title', type: 'text', required: true, localized: true },
            { name: 'text', type: 'textarea', required: true, localized: true },
            {
              name: 'ctaLabel',
              label: 'Button label',
              type: 'text',
              localized: true,
              admin: { description: 'Optional button on this step (e.g. "Book a first talk").' },
            },
            {
              name: 'ctaHref',
              label: 'Button target',
              type: 'text',
              admin: {
                description:
                  'Where the button links to. Left blank, it scrolls to the booking section of the page.',
              },
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Process section',
      admin: { initCollapsed: true },
      fields: [
        { name: 'processKicker', type: 'text', localized: true },
        { name: 'processHeading', type: 'text', localized: true },
        { name: 'processIntro', type: 'textarea', localized: true },
      ],
    },
    {
      type: 'collapsible',
      label: 'Section headers',
      admin: {
        initCollapsed: true,
        description: 'Label / title / intro of the homepage projects section and of the Q&A page.',
      },
      fields: [
        { name: 'projectsSubtitle', type: 'text', localized: true },
        { name: 'projectsTitle', type: 'text', localized: true },
        { name: 'projectsIntro', type: 'textarea', localized: true },
        { name: 'qaSubtitle', type: 'text', localized: true },
        { name: 'qaTitle', type: 'text', localized: true },
        { name: 'qaIntro', type: 'textarea', localized: true },
      ],
    },
    {
      type: 'collapsible',
      label: 'Voices (quotes)',
      admin: {
        initCollapsed: true,
        description:
          'Quotes from partner NGOs, companies and members. The homepage shows all of them, between the process and the closing call-to-action; /ngos shows the NGOs\' quotes and /partners the companies\'. While this list is empty the sections stay hidden on the live site. Only real quotes, with the person\'s OK.',
      },
      fields: [
        {
          name: 'testimonials',
          label: 'Quotes',
          type: 'array',
          labels: { singular: 'Quote', plural: 'Quotes' },
          fields: [
            { name: 'quote', type: 'textarea', required: true, localized: true },
            {
              name: 'audience',
              label: 'Who is speaking',
              type: 'select',
              required: true,
              defaultValue: 'ngo',
              options: [
                { label: 'An NGO', value: 'ngo' },
                { label: 'A company', value: 'company' },
                { label: 'A member', value: 'member' },
              ],
              admin: {
                description: 'Decides where else the quote appears: NGO quotes on /ngos, company quotes on /partners.',
              },
            },
            { name: 'name', type: 'text', admin: { description: 'Who said it.' } },
            {
              name: 'role',
              type: 'text',
              localized: true,
              admin: { description: 'Their role, e.g. "Managing Director".' },
            },
            {
              name: 'organisation',
              type: 'text',
              admin: { description: 'Organisation or company; for a member, e.g. "Member since 2025".' },
            },
            {
              name: 'photo',
              type: 'upload',
              relationTo: 'media',
              admin: { description: 'Optional portrait, shown small beside the name.' },
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Closing call-to-action',
      admin: { initCollapsed: true },
      fields: [
        { name: 'ctaHeading', type: 'text', localized: true },
        { name: 'ctaText', type: 'textarea', localized: true },
        { name: 'ctaJoin', type: 'text', localized: true },
        { name: 'ctaContact', type: 'text', localized: true },
      ],
    },
    {
      type: 'collapsible',
      label: 'Student mode (application phase)',
      admin: {
        initCollapsed: true,
        description:
          'Used only while Site Configuration → Homepage audience is "Students". Every field is optional — left blank, the built-in wording is shown. Benefits, requirements and "ways to contribute" come from the Membership Page.',
      },
      fields: [
        {
          name: 'studentHeroTitle',
          type: 'text',
          localized: true,
          admin: { description: 'The big headline, e.g. "Build software for a non-profit. This semester."' },
        },
        { name: 'studentHeroLead', type: 'textarea', localized: true },
        {
          name: 'studentHeroCtaPrimary',
          type: 'text',
          localized: true,
          admin: {
            description:
              'The apply button — used in the hero, under the timeline and in the closing call-to-action. Links straight to the application form.',
          },
        },
        {
          name: 'studentHeroCtaSecondary',
          type: 'text',
          localized: true,
          admin: { description: 'The second hero button; scrolls down to the application timeline.' },
        },
        { name: 'studentWhyHeading', type: 'text', localized: true },
        { name: 'studentWhyIntro', type: 'textarea', localized: true },
        { name: 'studentProjectsTitle', type: 'text', localized: true },
        { name: 'studentProjectsIntro', type: 'textarea', localized: true },
      ],
    },
  ],
};
