import { CollectionConfig } from 'payload';

/**
 * Proof of consent — GDPR Art. 7(1) accountability.
 *
 * We run a self-hosted CMP (Klaro), so no vendor keeps our consent log for us.
 * Each row is one *interactive* decision: the visitor clicked something in the
 * banner. Silent re-application of a stored choice on later page loads is not
 * recorded, otherwise every pageview would append a duplicate and the log would
 * be worthless as evidence.
 *
 * Also relevant to Google's periodic EU User Consent Policy audit
 * (support.google.com/google-ads/answer/16724512): failing it can suspend
 * conversion measurement, which would break the Ad Grants ≥1-conversion/month
 * requirement.
 *
 * Deliberately minimal — **no IP, no user agent, no fingerprint**, consistent
 * with the rest of our analytics. The random `consentId` is mirrored in the
 * visitor's `cfc_consent_id` cookie, which is what makes a record linkable to
 * the browser that gave it; a record that ties to nothing proves nothing.
 *
 * `configVersion` records which banner configuration (and therefore which
 * wording) the decision was made against — see `CONSENT_CONFIG_VERSION` in the
 * inner site's `lib/klaroConfig.ts`.
 *
 * Note this collection is **not** covered by the analytics retention purge:
 * consent records must outlive the processing they authorise, since their whole
 * purpose is proving that processing was lawful at the time.
 */
export const ConsentRecords: CollectionConfig = {
  slug: 'consent-records',
  labels: { singular: 'Consent Record', plural: 'Consent Records' },
  admin: {
    useAsTitle: 'consentId',
    defaultColumns: ['consentId', 'statistics', 'marketing', 'configVersion', 'createdAt'],
    description:
      'Proof of cookie consent (GDPR Art. 7(1)). One row per interactive banner decision. No IP, no user agent — the random consent id matches the visitor\'s cfc_consent_id cookie. Never auto-purged.',
  },
  access: {
    // The public site files records anonymously…
    create: () => true,
    // …only logged-in admins may read / manage them.
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'consentId',
      type: 'text',
      required: true,
      index: true,
      maxLength: 64,
      admin: {
        readOnly: true,
        description:
          "Random id, also stored in the visitor's cfc_consent_id cookie so a stored consent can be matched to this record.",
      },
    },
    {
      name: 'statistics',
      type: 'checkbox',
      label: 'Statistics accepted',
      index: true,
      admin: {
        readOnly: true,
        description:
          'Audience measurement: our own first-party analytics + Google Analytics.',
      },
    },
    {
      name: 'marketing',
      type: 'checkbox',
      label: 'Marketing accepted',
      index: true,
      admin: {
        readOnly: true,
        description: 'Google Ads conversion tracking and ads personalisation.',
      },
    },
    {
      name: 'configVersion',
      type: 'number',
      admin: {
        readOnly: true,
        description:
          'Banner config version the choice was made against (CONSENT_CONFIG_VERSION). Identifies which wording the visitor saw.',
      },
    },
    {
      name: 'locale',
      type: 'text',
      maxLength: 16,
      admin: {
        readOnly: true,
        description: 'Language the banner was displayed in.',
      },
    },
    {
      name: 'path',
      type: 'text',
      maxLength: 512,
      admin: {
        readOnly: true,
        description: 'Page the decision was made on.',
      },
    },
  ],
};

export default ConsentRecords;
