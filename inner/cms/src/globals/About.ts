import { GlobalConfig } from 'payload';
import { pageAccess } from '../access/roles';

/**
 * About page content (/about). Editable in the CMS; the frontend falls back to
 * its built-in copy for any field left blank.
 */
export const About: GlobalConfig = {
  slug: 'about',
  label: 'About Page',
  access: pageAccess,
  fields: [
    { name: 'kicker', type: 'text', localized: true },
    { name: 'title', type: 'text', localized: true, admin: { description: 'Page headline.' } },
    { name: 'lead', type: 'textarea', localized: true },
    {
      name: 'story',
      type: 'array',
      admin: { description: 'Narrative paragraphs.' },
      fields: [{ name: 'text', type: 'textarea', required: true, localized: true }],
    },
    { name: 'valuesTitle', type: 'text', localized: true },
    {
      name: 'values',
      type: 'array',
      fields: [
        { name: 'title', type: 'text', required: true, localized: true },
        { name: 'text', type: 'textarea', required: true, localized: true },
      ],
    },
    { name: 'teamTeaser', type: 'textarea', localized: true },
    { name: 'teamCta', type: 'text', localized: true },
  ],
};
