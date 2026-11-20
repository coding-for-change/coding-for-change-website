import { GlobalConfig } from 'payload';
import { pageAccess } from '../access/roles';

export const Legal: GlobalConfig = {
  slug: 'legal',
  label: 'Legal (Imprint & Privacy)',
  access: pageAccess,
  fields: [
    {
      name: 'impressum',
      type: 'richText',
      required: true,
      localized: true,
      label: 'Impressum',
    },
    {
      name: 'privacyPolicy',
      type: 'richText',
      required: true,
      localized: true,
      label: 'Datenschutzerklärung (Privacy Policy)',
    },
  ],
};
