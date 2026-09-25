import { CollectionConfig } from 'payload';

export const Sponsors: CollectionConfig = {
  slug: 'sponsors',
  // The site calls them "Partners". Only the labels changed — the slug (and so
  // the DB tables and /api/sponsors) keeps the old name.
  labels: { singular: 'Partner', plural: 'Partners' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'url', 'tierRef'],
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    {
      name: 'url',
      label: 'Website',
      type: 'text',
      admin: {
        description:
          'The logo links here (opens in a new tab), e.g. https://www.hetzner.com. Left empty, the logo is not clickable.',
      },
    },
    {
      name: 'tierRef',
      label: 'Tier',
      type: 'relationship',
      relationTo: 'sponsor-tiers',
      admin: {
        description:
          'Which tier section this partner appears in (managed in Partner Tiers).',
      },
    },
    {
      // Deprecated: superseded by the `tierRef` relationship. Kept (nullable,
      // hidden) so existing data survives the migration; the site falls back to
      // it when a sponsor has no tierRef yet.
      name: 'tier',
      type: 'select',
      admin: {
        hidden: true,
        description: 'Deprecated — use the Tier relationship above.',
      },
      options: [
        { label: 'Platinum', value: 'platinum' },
        { label: 'Gold', value: 'gold' },
        { label: 'Silver', value: 'silver' },
        { label: 'Bronze', value: 'bronze' },
        { label: 'Partner', value: 'partner' },
      ],
    },
    { name: 'description', type: 'textarea', localized: true },
  ],
};
