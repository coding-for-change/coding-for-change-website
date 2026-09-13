/**
 * The Google tag (`gtag.js`), in Advanced Consent Mode.
 *
 * A **server component** on purpose. The IDs come from runtime `process.env`
 * rather than `NEXT_PUBLIC_*` because production images are prebuilt and pushed
 * to a registry — a `NEXT_PUBLIC_` var would have to be baked in at image-build
 * time via Dockerfile `ARG`s and CI build args. Reading them here works because
 * rendering is already dynamic (the root layout awaits the cookie-derived
 * locale). The IDs aren't secret; this is purely about deployment ergonomics.
 *
 * **We inject `gtag.js` from inside the inline script rather than rendering a
 * `<script src>` tag, and that is not a style choice.** Next's App Router hoists
 * `<script src>` elements from a layout to the very top of `<head>`, ahead of
 * inline scripts. Rendering the tag declaratively put `gtag.js` at byte ~1300
 * while the denied defaults sat at ~4050 — so an async `gtag.js` could
 * initialise *before* the defaults existed and write `_gcl_*` / `_ga*` cookies
 * with no consent. That is audit criterion 7 ("no cookies before consent")
 * failing, and it is invisible unless you read the rendered HTML. Creating the
 * element in JS after the defaults makes the order unconditional. The same
 * pattern is used for the Typekit stylesheet in `layout.tsx`.
 *
 * Order within the single inline script:
 *
 *   1. `dataLayer` + `gtag` shim, then `consent default` with **everything
 *      denied**.
 *   2. `config` for the Ads conversion ID and the GA4 measurement ID.
 *   3. inject `gtag.js`, async. It loads regardless of consent and sends
 *      cookieless pings while denied. That's what makes this *Advanced* rather
 *      than *Basic* Consent Mode, and the only mode under which Google can ever
 *      model the denied traffic.
 *
 * `ConsentManager` later flips the signals via `gtag('consent','update',…)`.
 * Because the shim defines `gtag` synchronously as a `dataLayer.push` wrapper,
 * an update that races ahead of gtag.js queues instead of vanishing.
 *
 * Renders nothing at all when unconfigured, so local dev and CI never post
 * phantom conversions to the live Ad Grants account.
 */

const ADS_ID = process.env.GOOGLE_ADS_CONVERSION_ID?.trim();
const GA4_ID = process.env.GA4_MEASUREMENT_ID?.trim();

/** Conversion labels, keyed to `AdsConversionAction` in `lib/googleAds.ts`. */
const ADS_LABELS = {
    waitlist: process.env.GOOGLE_ADS_LABEL_WAITLIST?.trim(),
    application: process.env.GOOGLE_ADS_LABEL_APPLICATION?.trim(),
    techtour: process.env.GOOGLE_ADS_LABEL_TECHTOUR?.trim(),
    contact: process.env.GOOGLE_ADS_LABEL_CONTACT?.trim(),
    booking: process.env.GOOGLE_ADS_LABEL_BOOKING?.trim(),
};

export default function GoogleTag() {
    if (!ADS_ID && !GA4_ID) return null;

    const labels = Object.fromEntries(
        Object.entries(ADS_LABELS).filter(([, v]) => Boolean(v))
    );

    const bootstrap =
        'window.dataLayer=window.dataLayer||[];' +
        'function gtag(){dataLayer.push(arguments);}' +
        'window.gtag=gtag;' +
        // Deny everything up front. `wait_for_update` gives the CMP a moment to
        // report a stored decision before gtag treats the denial as final, so a
        // returning visitor who already consented isn't briefly measured as
        // denied on every page load.
        "gtag('consent','default',{" +
        "'ad_storage':'denied'," +
        "'ad_user_data':'denied'," +
        "'ad_personalization':'denied'," +
        "'analytics_storage':'denied'," +
        "'wait_for_update':500" +
        '});' +
        // Keeps the click id flowing through internal navigations in the URL
        // instead of a cookie, so a denied visitor's journey still hangs together.
        "gtag('set','url_passthrough',true);" +
        // Redacts ad click identifiers from the pings sent while ad_storage is
        // denied. Google's stricter-privacy recommendation, and it's the honest
        // pairing with a denied default.
        "gtag('set','ads_data_redaction',true);" +
        "gtag('js',new Date());" +
        (ADS_ID ? `gtag('config','${ADS_ID}');` : '') +
        (GA4_ID ? `gtag('config','${GA4_ID}');` : '') +
        `window.__CFC_ADS__=${JSON.stringify({ conversionId: ADS_ID, labels })};` +
        // Only now fetch gtag.js — see the ordering note above. One script serves
        // both products; the id in the URL just picks the container to prime.
        "(function(){var s=document.createElement('script');s.async=true;" +
        `s.src='https://www.googletagmanager.com/gtag/js?id=${ADS_ID || GA4_ID}';` +
        'document.head.appendChild(s);})();';

    return <script dangerouslySetInnerHTML={{ __html: bootstrap }} />;
}
