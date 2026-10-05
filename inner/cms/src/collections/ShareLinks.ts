import type { CollectionConfig, CollectionBeforeValidateHook, CollectionAfterDeleteHook } from 'payload';
import { APIError } from 'payload';
import { randomBytes } from 'node:crypto';
import { endOfEventWeek, eveningOf } from '../lib/share/evening';

/**
 * A private link for the host company of one TechTour evening (Datenschutz
 * section 5): the company's contacts sign in with a code sent to their own
 * address, see the registrations for their evening – name, CV and the other
 * answers, never the email address – and admit or decline each person. The
 * page and its endpoints are in endpoints/share.ts.
 *
 * The link stops working at `expiresAt` (filled in as the end of the event
 * week when left empty, which is what the Datenschutz promises at the
 * latest), or at once when "Blocked" is ticked. Every sign-in, CV opened and
 * decision is written to `share-access-log`; deleting a link deletes its log.
 */

const TECHTOUR_FORM_TITLE = 'techtour';

const isUser = ({ req: { user } }: { req: { user?: unknown } }) => Boolean(user);

const fillDefaults: CollectionBeforeValidateHook = async ({ data, operation, originalDoc, req }) => {
  if (!data) return data;
  // The token is made once, here, and never taken from a request.
  data.token = operation === 'create' ? randomBytes(24).toString('base64url') : originalDoc?.token;

  if (!data.form) {
    const forms = await req.payload.find({
      collection: 'forms',
      where: { title: { equals: TECHTOUR_FORM_TITLE } },
      depth: 0,
      limit: 1,
      req,
    });
    data.form = forms.docs[0]?.id;
  }

  if (Array.isArray(data.recipients)) {
    data.recipients = data.recipients.map((r: { email?: string }) => ({
      ...r,
      email: (r.email ?? '').trim().toLowerCase(),
    }));
  }

  if (!data.expiresAt && data.form && data.option) {
    const evening = await eveningOf(req.payload, data.form, data.option, req);
    const end = evening?.date ? endOfEventWeek(evening.date) : null;
    if (end) data.expiresAt = end.toISOString();
  }
  // Without an evening the field check says so; with one whose date the
  // TechTour page does not know, the end date has to be set by hand.
  if (!data.expiresAt && data.option) {
    throw new APIError(
      'Set "Expires" – the TechTour page has no date for this evening (at the latest the end of the event week).',
      400,
    );
  }
  return data;
};

const deleteActivity: CollectionAfterDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: 'share-access-log',
    where: { link: { equals: id } },
    overrideAccess: true,
    req,
  });
};

export const ShareLinks: CollectionConfig = {
  slug: 'share-links',
  labels: { singular: 'Host share link', plural: 'Host share links' },
  admin: {
    group: 'Forms',
    useAsTitle: 'title',
    defaultColumns: ['title', 'expiresAt', 'blocked', 'updatedAt'],
    description:
      'One private link per TechTour evening for its host company. The contacts listed sign in with a code sent to their address, see the registrations for that evening (name, CV, other answers – never the email address) and admit or decline each person. The link expires on its own; tick "Blocked" to stop it at once. Every sign-in, CV opened and decision is listed under "Host link activity".',
  },
  access: {
    read: isUser,
    create: isUser,
    update: isUser,
    delete: isUser,
  },
  hooks: {
    beforeValidate: [fillDefaults],
    afterDelete: [deleteActivity],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Heading of the page the host sees, e.g. "QuantCo – Wed 11 Nov".',
      },
    },
    {
      name: 'option',
      type: 'text',
      required: true,
      label: 'Evening',
      admin: {
        description: 'The host sees everyone who registered for this evening.',
        components: { Field: '/components/share/EveningField#EveningField' },
      },
    },
    {
      name: 'recipients',
      type: 'array',
      label: 'Contacts at the company',
      labels: { singular: 'Contact', plural: 'Contacts' },
      minRows: 1,
      required: true,
      admin: {
        description:
          'Who may open the link. Each signs in with a six-digit code sent to the address entered here, so a forwarded link alone opens nothing.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'email', type: 'email', required: true, admin: { width: '50%' } },
            { name: 'name', type: 'text', admin: { width: '50%' } },
          ],
        },
      ],
    },
    {
      name: 'link',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '/components/share/ShareLinkUrl#ShareLinkUrl' },
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      label: 'Expires',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'The link stops working then. Left empty, it is the end of the event week – the latest the Datenschutz allows.',
      },
    },
    {
      name: 'blocked',
      type: 'checkbox',
      label: 'Blocked',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Stops the link at once (and anyone signed in). Untick to open it again.',
      },
    },
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'forms',
      admin: {
        position: 'sidebar',
        description: 'The registration form – the one titled "techtour" unless you pick another.',
      },
    },
    {
      name: 'token',
      type: 'text',
      unique: true,
      index: true,
      admin: { hidden: true },
    },
  ],
};
