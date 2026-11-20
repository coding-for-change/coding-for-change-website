import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access/roles';

/**
 * What happened on the host share links (collections/ShareLinks.ts): who
 * signed in, which CV they opened, what they decided and rated, whom they
 * moved on the waitlist. Written only by
 * endpoints/share.ts; read-only in the admin. Deleted together with its link.
 *
 * Holds the contact's email address and the id of the registration acted on –
 * nothing from the registration itself.
 */

export const SHARE_ACTIONS = [
  { label: 'Code sent', value: 'code' },
  { label: 'Signed in', value: 'sign-in' },
  { label: 'Opened a CV', value: 'cv' },
  { label: 'Admitted', value: 'admitted' },
  { label: 'Declined', value: 'declined' },
  { label: 'Decision undone', value: 'undone' },
  { label: 'Signed out', value: 'sign-out' },
  { label: 'Put on the waitlist', value: 'waitlisted' },
  { label: 'Rated (1–10)', value: 'rated' },
  { label: 'Moved on the waitlist', value: 'moved' },
] as const;

export type ShareAction = (typeof SHARE_ACTIONS)[number]['value'];

export const ShareAccessLog: CollectionConfig = {
  slug: 'share-access-log',
  labels: { singular: 'Host link activity', plural: 'Host link activity' },
  admin: {
    defaultColumns: ['createdAt', 'link', 'email', 'action', 'submission'],
    description:
      'Every sign-in, CV opened, decision and rating on a host share link. Written by the link itself; deleted together with the link.',
  },
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    { name: 'link', type: 'relationship', relationTo: 'share-links', index: true },
    { name: 'email', type: 'text', label: 'Contact' },
    { name: 'action', type: 'select', options: [...SHARE_ACTIONS] },
    {
      name: 'submission',
      type: 'number',
      label: 'Registration',
      admin: { description: 'Id of the registration the CV, decision or rating was about.' },
    },
  ],
};
