import { CollectionConfig } from 'payload';

/**
 * Sponsor tiers, managed in the CMS (add / rename / reorder without code).
 * Sponsors point to a tier via the `tierRef` relationship; the public site
 * groups sponsors into tier sections ordered by `order` (lower = higher tier).
 * The admin and the site call them "Partner Tiers"; the slug keeps the old name.
 */
export const SponsorTiers: CollectionConfig = {
  slug: 'sponsor-tiers',
  labels: { singular: 'Partner Tier', plural: 'Partner Tiers' },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'order'],
    description: 'Tier sections for the Partners page (e.g. Platinum, Gold …).',
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'label', type: 'text', required: true, localized: true },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 100,
      admin: { description: 'Lower shows first (e.g. Platinum 10, Gold 20, Silver 30 …).' },
    },
  ],
};
