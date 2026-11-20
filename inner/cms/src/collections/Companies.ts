import { CollectionConfig } from 'payload';
import { contentAccess } from '../access/roles';

// Companies where our team members have previously worked. Rendered as a
// logo "wall" on the Team page for a bit of credibility name-dropping.
export const Companies: CollectionConfig = {
  slug: 'companies',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'url'],
    description:
      'Companies our team members have worked at — shown as a logo wall on the Team page.',
  },
  access: contentAccess,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'url', type: 'text' },
  ],
};
