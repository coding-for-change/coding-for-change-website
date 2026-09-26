import { GlobalConfig } from 'payload';

// The Join page (/join) takes its headline and lead from here; everything
// else on it – what to expect, the ways to get involved, the three steps of
// the application – is copy in the site's translations, and the application
// round's dates live in `inner/src/lib/applicationPhase.ts`.
export const Membership: GlobalConfig = {
  slug: 'membership',
  label: 'Membership Page',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
      admin: { description: 'Headline of the Join page (/join).' },
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      localized: true,
      admin: { description: 'The lead under the headline – one or two sentences.' },
    },
    {
      name: 'contactEmail',
      type: 'email',
      required: true,
      admin: {
        description: 'Shown on the application page (/join/apply) for questions about applying.',
      },
    },
  ],
};
