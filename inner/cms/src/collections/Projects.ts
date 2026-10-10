import { CollectionConfig } from 'payload';

export const Projects: CollectionConfig = {
  slug: 'projects',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'ngoPartner', 'status', 'featured'],
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'ngoPartner', type: 'text', required: true, label: 'NGO Partner', localized: true },
    {
      // URL slug for the case-study detail page (/projects/<slug>). Optional so
      // the migration adds a nullable column over existing rows; set it in the
      // admin for every project you want a detail page for. Not localized — the
      // URL is shared across languages.
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Lowercase, hyphenated (e.g. "lebenshilfe-muenchen"). Needed for the detail page.',
      },
    },
    {
      // Marks the flagship project — highlighted on the homepage / projects list.
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    { name: 'description', type: 'textarea', required: true, localized: true },
    { name: 'image', type: 'upload', relationTo: 'media' },
    {
      name: 'technologies',
      type: 'array',
      fields: [{ name: 'name', type: 'text', required: true, localized: true }],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Completed', value: 'completed' },
        { label: 'Recruiting', value: 'recruiting' },
      ],
    },
    {
      name: 'links',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true, localized: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      // Who works on this project. Deliberately a project-level field and not
      // part of the case study below: the Team page reads these assignments to
      // show what each person works on, and that has to work for a project
      // whose case study hasn't been written yet (most of them).
      name: 'team',
      label: 'Team',
      type: 'array',
      labels: { singular: 'Member', plural: 'Members' },
      admin: {
        description:
          'Who works on this project. Shown on the Team page under each person — no case study needed. The case study\'s "Team" block reuses this list.',
      },
      fields: [
        { name: 'member', type: 'relationship', relationTo: 'team', required: true },
        {
          name: 'role',
          type: 'text',
          localized: true,
          admin: {
            description:
              'Role on this project (e.g. "Project Lead"). Falls back to the member\'s main role if blank.',
          },
        },
      ],
    },
    // ---- Case-study head (shown at the top of /projects/<slug>) ----
    {
      name: 'impactHeadline',
      type: 'text',
      localized: true,
      admin: { description: 'The case-study page headline (falls back to the project title).' },
    },
    {
      name: 'impact',
      type: 'text',
      localized: true,
      admin: { description: 'A one-line impact highlight shown under the headline (e.g. "Saves ~150 companions hours of paperwork a month").' },
    },
    {
      // Coverage of the project. Not localized: an article exists in one
      // language, and a German newspaper piece is worth showing to an English
      // reader too.
      name: 'press',
      label: 'Press',
      type: 'array',
      labels: { singular: 'Article', plural: 'Articles' },
      admin: {
        description: 'Articles about this project. Shown as a "featured in" badge at the top of the case study.',
      },
      fields: [
        {
          name: 'outlet',
          type: 'text',
          required: true,
          admin: { description: 'e.g. "Süddeutsche Zeitung"' },
        },
        {
          name: 'headline',
          type: 'text',
          required: true,
          admin: { description: 'The article headline, in its original language.' },
        },
        { name: 'url', type: 'text', required: true },
        { name: 'date', type: 'date' },
        {
          name: 'logo',
          type: 'upload',
          relationTo: 'media',
          admin: { description: 'The outlet’s mark, ideally a trimmed SVG/PNG without background. Optional – the badge names the outlet either way.' },
        },
      ],
    },
    // ---- Case-study body: freely-orderable content blocks ----
    {
      name: 'layout',
      label: 'Case study content',
      type: 'blocks',
      admin: {
        description:
          'The body of the case-study page. Add, remove and reorder blocks freely — text sections, quote, gallery, product demo, timeline, team and FAQ.',
      },
      blocks: [
        {
          slug: 'text',
          labels: { singular: 'Text section', plural: 'Text sections' },
          fields: [
            {
              name: 'heading',
              type: 'text',
              localized: true,
              admin: { description: 'Optional section heading (e.g. "The challenge").' },
            },
            {
              name: 'body',
              type: 'textarea',
              required: true,
              localized: true,
              admin: { description: 'Paragraph text. Separate paragraphs with a blank line.' },
            },
          ],
        },
        {
          slug: 'quote',
          labels: { singular: 'Quote', plural: 'Quotes' },
          fields: [
            { name: 'text', type: 'textarea', required: true, localized: true },
            { name: 'author', type: 'text' },
            { name: 'role', type: 'text', localized: true },
          ],
        },
        {
          slug: 'gallery',
          labels: { singular: 'Gallery', plural: 'Galleries' },
          fields: [
            {
              name: 'heading',
              type: 'text',
              localized: true,
              admin: { description: 'Optional section heading (e.g. "From the workshop").' },
            },
            {
              // Product shots and photographs want opposite treatments, and the
              // difference is editorial, not something the code can infer from
              // the file: mock-ups need a ground to stand on, photographs need
              // to be big and uniformly cropped.
              name: 'layout',
              type: 'select',
              defaultValue: 'stage',
              options: [
                { label: 'Product shots — stood on a tinted stage', value: 'stage' },
                { label: 'Photographs — edge-to-edge grid', value: 'photos' },
              ],
              admin: {
                description:
                  'Use "Product shots" for app screens and device mock-ups, "Photographs" for workshops, on-site visits and presentations.',
              },
            },
            {
              name: 'images',
              type: 'array',
              minRows: 1,
              labels: { singular: 'Image', plural: 'Images' },
              fields: [
                { name: 'image', type: 'upload', relationTo: 'media', required: true },
                { name: 'caption', type: 'text', localized: true },
              ],
            },
          ],
        },
        {
          // A demo of the thing itself — the strongest argument on a case-study
          // page, and the piece another organisation needs before it can picture
          // the software running at its own desk.
          //
          // Self-hosted upload only. A YouTube/Vimeo URL field shipped here
          // first and the consent scan rejected it, correctly: those players
          // store data on a visitor's device whenever they load, which under
          // TDDDG § 25 needs consent regardless of whether the load is
          // automatic or click-triggered. Adding them back means a declared
          // Klaro service, a consent gate in the component, and an Art. 13
          // entry in the Datenschutz — see the consent section of CLAUDE.md.
          slug: 'demo',
          labels: { singular: 'Product demo', plural: 'Product demos' },
          fields: [
            {
              name: 'heading',
              type: 'text',
              localized: true,
              admin: { description: 'Optional section heading (e.g. "See it in action").' },
            },
            {
              name: 'video',
              type: 'upload',
              relationTo: 'media',
              required: true,
              admin: {
                description:
                  'A screen recording (MP4), served from our own domain. Keep it short and silent-friendly — it plays on tap, never on its own.',
              },
            },
            {
              name: 'poster',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Still frame shown before playback. Recommended for embeds.',
              },
            },
            { name: 'caption', type: 'text', localized: true },
          ],
        },
        {
          slug: 'timeline',
          labels: { singular: 'Timeline', plural: 'Timelines' },
          fields: [
            {
              name: 'heading',
              type: 'text',
              localized: true,
              admin: { description: 'Optional section heading (e.g. "How it came together").' },
            },
            {
              name: 'points',
              type: 'array',
              minRows: 1,
              labels: { singular: 'Point', plural: 'Points' },
              fields: [
                {
                  name: 'marker',
                  type: 'text',
                  admin: {
                    description:
                      'Shown inside the circle — a number (1, 2, 3) or a symbol (e.g. ✓). Leave blank to auto-number by position.',
                  },
                },
                {
                  name: 'timing',
                  type: 'text',
                  localized: true,
                  admin: {
                    description: 'Small badge above the title (e.g. "March 2026" or "Week 2").',
                  },
                },
                { name: 'title', type: 'text', required: true, localized: true },
                { name: 'subtitle', type: 'text', localized: true },
                {
                  name: 'state',
                  type: 'select',
                  options: [
                    { label: 'Done', value: 'done' },
                    { label: 'Current', value: 'current' },
                    { label: 'Upcoming', value: 'upcoming' },
                  ],
                  admin: {
                    description:
                      'Progress marker: set "Current" on the phase the project is in — earlier steps then show as done, later ones as upcoming. Leave every point blank for a plain timeline.',
                  },
                },
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  admin: {
                    description: 'Optional screenshot or mock-up shown with this step.',
                  },
                },
              ],
            },
          ],
        },
        {
          slug: 'team',
          labels: { singular: 'Team', plural: 'Teams' },
          fields: [
            {
              name: 'heading',
              type: 'text',
              localized: true,
              admin: { description: 'Optional section heading (e.g. "The team behind it").' },
            },
            {
              // No minRows: leaving this empty is the normal case now — the
              // block then renders the project-level `team` above, so the
              // assignment is maintained in exactly one place. Rows here
              // override that list (and keep pre-existing case studies working).
              name: 'members',
              type: 'array',
              labels: { singular: 'Member', plural: 'Members' },
              admin: {
                description:
                  'Leave empty to show the project\'s Team (set further up this page). Add rows only to show a different list here.',
              },
              fields: [
                { name: 'member', type: 'relationship', relationTo: 'team', required: true },
                {
                  name: 'role',
                  type: 'text',
                  localized: true,
                  admin: {
                    description:
                      'Role on this project (e.g. "Project Lead"). Falls back to the member\'s main role if blank.',
                  },
                },
              ],
            },
          ],
        },
        {
          slug: 'faq',
          labels: { singular: 'FAQ', plural: 'FAQs' },
          fields: [
            {
              name: 'items',
              type: 'array',
              minRows: 1,
              labels: { singular: 'Question', plural: 'Questions' },
              fields: [
                { name: 'question', type: 'text', required: true, localized: true },
                { name: 'answer', type: 'textarea', required: true, localized: true },
              ],
            },
          ],
        },
      ],
    },
  ],
};
