/**
 * Google Ads conversion tracking — the Ad Grants compliance requirement.
 *
 * The Ad Grants account-management policy requires accounts created after
 * 2019-04-22 to record **at least one conversion per month** and to run
 * conversion-based Smart Bidding on every campaign. Missing that gets the
 * account temporarily deactivated, so these four actions are load-bearing, not
 * nice-to-have.
 *
 * Each conversion fires alongside the existing first-party `trackConversion()`
 * call, so our Postgres funnel stays the ground truth and Google gets its own
 * copy. The two are independent on purpose: Google only ever sees conversions
 * from visitors who consented to marketing, while our own table (with consent
 * for statistics) plus the raw submission rows still show what really happened.
 *
 * IDs come from runtime env via the layout — they are not secrets, but they do
 * differ per environment, and an unset ID must be a silent no-op so local dev
 * and CI never post phantom conversions to the live account.
 */

export type AdsConversionAction =
    | 'waitlist'
    | 'application'
    | 'techtour'
    | 'contact'
    | 'booking';

/**
 * Populated by the inline bootstrap in `layout.tsx` from server-side env, since
 * `NEXT_PUBLIC_*` would have to be baked in at image-build time and our
 * production images are prebuilt and pushed to a registry.
 */
interface AdsConfig {
    conversionId?: string;
    labels?: Partial<Record<AdsConversionAction, string>>;
}

declare global {
    interface Window {
        __CFC_ADS__?: AdsConfig;
    }
}

/**
 * Fire a Google Ads conversion.
 *
 * Deliberately does *not* check consent itself: Consent Mode is the gate. When
 * marketing consent is denied, `gtag` still receives the event but sends it as a
 * cookieless ping with no identifiers, which is exactly what Google's Advanced
 * Consent Mode expects and is what makes conversion modelling possible later.
 * Gating here instead would throw that away and send nothing at all.
 */
export function trackAdsConversion(action: AdsConversionAction): void {
    if (typeof window === 'undefined') return;

    const cfg = window.__CFC_ADS__;
    const id = cfg?.conversionId;
    const label = cfg?.labels?.[action];
    if (!id || !label) return; // not configured (dev/CI) — stay silent

    try {
        window.gtag?.('event', 'conversion', {
            send_to: `${id}/${label}`,
        });
    } catch {
        /* a failed conversion ping must never break a form submit */
    }
}
