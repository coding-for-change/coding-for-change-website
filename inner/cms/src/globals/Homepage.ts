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
        { name: 'heroKicker', type: 'text', localized: true },
        { name: 'heroCtaPrimary', type: 'text', localized: true },
        { name: 'heroCtaSecondary', type: 'text', localized: true },
        { name: 'heroScrollHint', type: 'text', localized: true },
        {
          name: 'heroImage',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description:
              'Optional hero image beside the headline — ideally a wide candid of the team mid-build. Left empty, the hero stays text-only.',
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'About section',
      admin: { initCollapsed: true },
      fields: [
        { name: 'aboutKicker', type: 'text', localized: true },
        { name: 'aboutOneLiner', type: 'textarea', localized: true },
        { name: 'aboutPitch', type: 'textarea', localized: true },
        {
          name: 'stats',
          type: 'array',
          fields: [
            { name: 'value', type: 'text', required: true, localized: true },
            { name: 'label', type: 'text', required: true, localized: true },
          ],
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
      admin: { initCollapsed: true, description: 'Eyebrow / title / intro for each homepage section.' },
      fields: [
        { name: 'projectsSubtitle', type: 'text', localized: true },
        { name: 'projectsTitle', type: 'text', localized: true },
        { name: 'projectsIntro', type: 'textarea', localized: true },
        { name: 'eventsSubtitle', type: 'text', localized: true },
        { name: 'eventsTitle', type: 'text', localized: true },
        { name: 'eventsIntro', type: 'textarea', localized: true },
        { name: 'sponsorsSubtitle', label: 'Partners Subtitle', type: 'text', localized: true },
        { name: 'sponsorsTitle', label: 'Partners Title', type: 'text', localized: true },
        { name: 'sponsorsIntro', label: 'Partners Intro', type: 'textarea', localized: true },
        { name: 'qaSubtitle', type: 'text', localized: true },
        { name: 'qaTitle', type: 'text', localized: true },
        { name: 'qaIntro', type: 'textarea', localized: true },
      ],
    },
    {
      type: 'collapsible',
      label: '3D band',
      admin: { initCollapsed: true },
      fields: [
        { name: 'threedKicker', type: 'text', localized: true },
        { name: 'threedTitle', type: 'text', localized: true },
        { name: 'threedText', type: 'textarea', localized: true },
        { name: 'threedCta', type: 'text', localized: true },
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
  ],
};
