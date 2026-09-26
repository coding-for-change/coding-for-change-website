import { CollectionConfig } from 'payload';
import { attributionField } from '../fields/attribution';

// Emails collected on /join/apply while applications are closed ("sign up to
// know first when applications open"). The public inner site POSTs to
// /api/waitlist-signups; only authenticated admins can read the list back, so
// the collected addresses can't be scraped through the public REST API.
export const WaitlistSignups: CollectionConfig = {
  slug: 'waitlist-signups',
  labels: {
    singular: 'Waitlist Signup',
    plural: 'Waitlist Signups',
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'locale', 'createdAt'],
    group: 'Forms',
    description:
      'People who asked to be notified when membership applications reopen.',
    components: {
      // "Email all waitlist signups" form — sends one individual mail per
      // address through /api/waitlist/send-email (see endpoints/waitlistEmail.ts).
      beforeListTable: ['/components/waitlist/SendWaitlistEmail#SendWaitlistEmail'],
    },
  },
  access: {
    // Anyone may add themselves to the list…
    create: () => true,
    // …but only logged-in admins may read / manage it.
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  hooks: {
    // Normalise so casing/whitespace don't create near-duplicate rows.
    beforeValidate: [
      ({ data }) => {
        if (data?.email) {
          data.email = String(data.email).trim().toLowerCase();
        }
        return data;
      },
    ],
  },
  fields: [
    { name: 'email', type: 'email', required: true },
    {
      name: 'locale',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Site language the person signed up in.',
      },
    },
    // Which campaign / traffic source this signup came from (see the shared
    // field for details). Populated from the client on submit; empty for
    // direct/organic signups.
    attributionField,
  ],
  // createdAt / updatedAt are added automatically (timestamps default to true),
  // giving us the signup date used for column display and export ordering.
};
