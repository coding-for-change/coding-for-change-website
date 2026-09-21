import { GlobalConfig } from 'payload';

/**
 * The Munich TechTour page (/techtour): a week of company visits where we
 * introduce students to Munich tech employers. This global holds the visits and
 * the registration settings. The registration form itself is the form-builder
 * form titled "techtour", so questions are added in the admin.
 *
 * Every field here is rendered by the site. The page's own wording — the poster
 * headline, the fact labels, the "Explore the week" heading and its lead — is
 * not content but part of the layout, and lives in the site's translation table
 * (`inner/src/i18n/translations.ts`, key `techtour`); a field for it here would
 * be a knob that changes nothing. Anything added below has to be rendered by
 * `components/showcase/TechTour*.tsx` in the same change, or it becomes the
 * same dead weight.
 */
export const TechTour: GlobalConfig = {
  slug: 'tech-tour',
  label: 'TechTour Page',
  access: {
    read: () => true,
  },
  admin: {
    description:
      'The visits and the registration settings for the Munich TechTour page. The registration form is the form titled "techtour" under Forms; the page\'s headline and section wording are part of the design, not content.',
  },
  fields: [
    {
      // Publishing switch. Content is written in the admin over days; until it
      // is complete the page must not be indexed, and optionally not linked.
      // The site reads this in three places: the page's robots meta, the nav +
      // footer links, and the sitemap (public only).
      name: 'visibility',
      type: 'select',
      defaultValue: 'unlisted',
      options: [
        {
          label: 'Hidden — reachable by its link only (not in navigation, not indexed)',
          value: 'hidden',
        },
        {
          label: 'Unlisted — in navigation, but hidden from search engines',
          value: 'unlisted',
        },
        {
          label: 'Public — in navigation, indexed, listed in the sitemap',
          value: 'public',
        },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Switch to "Public" once the content is complete. Hidden and Unlisted pages carry a noindex tag and are left out of the sitemap; Hidden also removes the "TechTour 2026" link from the navigation and footer.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'registrationOpen',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            width: '50%',
            description:
              'Untick to close registration: the page shows the "registration closed" message instead of the form.',
          },
        },
        {
          name: 'registrationDeadline',
          type: 'date',
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayAndTime' },
            description:
              'Optional. Shown on the page as the "apply by" fact and as step 1 of the registration; once it has passed the form closes on its own.',
          },
        },
      ],
    },
    {
      name: 'events',
      label: 'Company visits',
      type: 'array',
      admin: {
        initCollapsed: true,
        description:
          'One entry per visit, in date order. The page counts them, takes its date range from the first and last, and gives each one a panel in the "Explore" section and a row in the registration form. Use "To be announced" for a slot whose company is not fixed yet, and leave time/location empty while unknown — the page says so instead of showing a blank.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'company',
              type: 'text',
              required: true,
              admin: { width: '50%', description: 'Company name, or "To be announced".' },
            },
            {
              name: 'date',
              type: 'date',
              required: true,
              admin: { width: '50%', date: { pickerAppearance: 'dayOnly' } },
            },
          ],
        },
        {
          name: 'title',
          type: 'text',
          localized: true,
          admin: {
            description:
              'Optional headline for the visit, e.g. "Startup evening at Lio". Defaults to the company name.',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'time',
              type: 'text',
              localized: true,
              admin: { width: '50%', description: 'e.g. "18:00–20:00". Empty = "time to be announced".' },
            },
            {
              name: 'location',
              type: 'text',
              localized: true,
              admin: { width: '50%', description: 'Empty = "location to be announced".' },
            },
          ],
        },
        {
          name: 'description',
          type: 'textarea',
          localized: true,
          admin: {
            description:
              'What happens at this visit and why a student should come. The "Explore" panel shows it in full; the registration form shows its first sentence next to the tick box, so make that sentence the one that identifies the visit.',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'logo',
              type: 'upload',
              relationTo: 'media',
              admin: { width: '50%', description: 'Company logo (SVG or PNG on transparent).' },
            },
            { name: 'website', type: 'text', admin: { width: '50%' } },
          ],
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description:
              'Photo for this visit in the "Explore" section further down the page — the office, the team, the space. Landscape works best. Without one the section falls back to the logo on a plain panel.',
          },
        },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'confirmed',
          options: [
            { label: 'Confirmed', value: 'confirmed' },
            { label: 'Tentative', value: 'tentative' },
            { label: 'To be announced', value: 'tba' },
          ],
          admin: {
            description:
              '"Tentative" marks a visit that is not certain yet; "To be announced" is a placeholder slot without a company.',
          },
        },
      ],
    },
    {
      name: 'formHeading',
      type: 'text',
      localized: true,
      admin: { description: 'Heading of the registration page /techtour/apply. Default: "Register for the TechTour".' },
    },
    {
      name: 'closedMessage',
      type: 'textarea',
      localized: true,
      admin: { description: 'Shown instead of the form while registration is closed.' },
    },
  ],
};
