import { CollectionConfig } from 'payload';
import { attributionField } from '../fields/attribution';
import { isAdmin, isEditor } from '../access/roles';

// The behavioural events the site beacons in. Kept as a fixed list so the data
// stays queryable; extend here (and in the inner `lib/analytics.ts` helpers)
// when a new step is added to the funnel.
export const EVENT_TYPES = [
  'landing',
  'pageview',
  'cta_click',
  'form_start',
  'conversion',
  'outbound_click',
  // Booking widget scrolled into view. An impression, not intent — kept for
  // funnel shape only, never used as an ad conversion.
  'booking_started',
  // A booking actually submitted on cal.com (embed `bookingSuccessful` event).
  // This is the real conversion.
  'booking_completed',
] as const;

/**
 * First-party behavioural analytics.
 *
 * The inner site beacons events here (page views, form starts, conversions)
 * tagged with the visit's random `sessionId` and its campaign attribution, so we
 * can measure the funnel from traffic source → interaction → conversion.
 *
 * No IP, no fingerprint, no cookies, **no device storage of any kind.** The only
 * identifier is `sessionId`, which lives in the page's JavaScript memory and is
 * gone on refresh, in a new tab, and when the tab closes. Scope is therefore one
 * tab — enough to link "arrived from poster-tumsom" to "signed up", which is the
 * question this collection exists to answer.
 *
 * **Not consent-gated, deliberately.** It was, briefly, alongside a persistent
 * `visitorId`. Because that identifier was device storage under TDDDG § 25 the
 * whole subsystem sat behind the consent banner — and collection fell to zero,
 * since the banner isn't a cookie wall and almost nobody answers it. § 25 is
 * triggered by storing on or reading from the device, not by measurement as such,
 * so with the storage gone the ordinary Art. 6(1)(f) basis applies. DNT/GPC are
 * honoured as the Art. 21 objection route. Google Ads and GA4 remain fully gated
 * — they set real cookies.
 *
 * Public create (the site posts anonymously); admin-only read — mirrors the
 * WaitlistSignups access model.
 */
export const AnalyticsEvents: CollectionConfig = {
  slug: 'analytics-events',
  labels: { singular: 'Analytics Event', plural: 'Analytics Events' },
  admin: {
    useAsTitle: 'type',
    defaultColumns: ['type', 'label', 'path', 'createdAt'],
    description:
      'Cookieless behavioural events (page views, form starts, conversions) for campaign & funnel analysis. No cookies, no IP, no personal data — a random per-visit session id links events to a conversion.',
  },
  access: {
    // The public site beacons events in anonymously…
    create: () => true,
    // …editors may read them (the analytics are theirs too), only admins
    // change or delete them.
    read: isEditor,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      index: true,
      options: EVENT_TYPES.map((v) => ({ label: v, value: v })),
    },
    {
      name: 'path',
      type: 'text',
      maxLength: 512,
      admin: {
        readOnly: true,
        description: 'Page path where the event occurred.',
      },
    },
    {
      name: 'label',
      type: 'text',
      maxLength: 256,
      admin: {
        readOnly: true,
        description:
          'Event detail — CTA id, form name, conversion kind, or link host.',
      },
    },
    {
      name: 'locale',
      type: 'text',
      maxLength: 16,
      admin: { readOnly: true, description: 'Site language at the time.' },
    },
    // Same shared group as the conversion collections, so events and
    // conversions expose identical, joinable attribution columns.
    attributionField,
    {
      name: 'meta',
      type: 'json',
      admin: { readOnly: true, description: 'Optional extra event data.' },
    },
  ],
  // createdAt / updatedAt are added automatically and drive time-range reporting
  // and the (Phase 4) retention purge.
};
