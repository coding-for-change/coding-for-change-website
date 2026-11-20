import { CollectionConfig } from 'payload';
import { contentAccess } from '../access/roles';

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'date', 'type', 'isUpcoming'],
  },
  access: contentAccess,
  fields: [
    { name: 'title', type: 'text', required: true, localized: true },
    { name: 'date', type: 'text', required: true },
    { name: 'time', type: 'text', required: true },
    { name: 'location', type: 'text', required: true, localized: true },
    { name: 'description', type: 'textarea', required: true, localized: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Hackathon', value: 'Hackathon' },
        { label: 'Workshop', value: 'Workshop' },
        { label: 'Info Session', value: 'Info-session' },
        { label: 'Social', value: 'Social' },
      ],
    },
    { name: 'isUpcoming', type: 'checkbox', defaultValue: true, label: 'Upcoming?' },
    {
      name: 'link',
      type: 'group',
      label: 'Action Button',
      fields: [
        { name: 'label', type: 'text', localized: true },
        { name: 'url', type: 'text' },
      ],
    },
  ],
};
