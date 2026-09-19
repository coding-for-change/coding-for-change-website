/**
 * Klaro CMP configuration — the consent banner's single source of truth.
 *
 * Deliberately built against the eight things Google checks in an EU User
 * Consent Policy audit (support.google.com/google-ads/answer/16724512), because
 * failing one can suspend conversion measurement and take the Ad Grant with it:
 *
 *   1. visible banner requiring affirmative action  → `mustConsent: false` + notice
 *   2. ads personalisation disclosed BY NAME        → `googleAdsDescription` below
 *   3. accept AND reject both genuinely work        → `hideDeclineAll: false`
 *   4. third-party data sharing disclosed           → Google named in both services
 *   5. link to Google's Business Data Responsibility site → `GOOGLE_BDR_URL`
 *   6. Consent Mode v2 signals                      → wired in `ConsentManager.tsx`
 *   7. no cookies before consent                    → `default: false`, denied defaults
 *   8. CMP configured correctly                     → this file, reviewed in git
 *
 * Services are grouped by *purpose*, not vendor: consent is a purpose-level
 * decision under GDPR.
 *
 * Note what is deliberately NOT here: our own first-party visitor counting. It
 * used to sit under the analytics purpose, back when it wrote to
 * `sessionStorage`/`localStorage`. It now keeps its state in page memory only
 * (see `lib/attribution.ts`), so no TDDDG § 25 storage event occurs and there is
 * nothing to consent to — it runs on Art. 6(1)(f) with DNT/GPC as the Art. 21
 * objection route. Gating it here took measurement to zero, because almost
 * nobody answers a banner that doesn't block them.
 *
 * Bumping `CONSENT_CONFIG_VERSION` invalidates stored consent and re-asks
 * everyone. Do that whenever a service is added or a purpose materially
 * changes — it is also the value recorded against each consent record, so an
 * audit can tell which banner text a given consent was given against.
 */
import type { Locale } from '@/i18n/translations';

/** Audit criterion 5 — must be reachable from the banner. */
export const GOOGLE_BDR_URL = 'https://business.safety.google/privacy/';

/**
 * Bump on any material change to services or purposes. See note above.
 *
 * v2: the analytics purpose narrowed to Google Analytics only — our own visitor
 * counting moved out of consent entirely when it stopped touching device
 * storage. Strictly this *reduces* what is consented to, so a re-ask isn't
 * legally required, but the wording changed materially and only a handful of
 * consents existed, so re-asking against the accurate text is nearly free.
 */
export const CONSENT_CONFIG_VERSION = 2;

export const SERVICE_NECESSARY = 'necessary';
export const SERVICE_ANALYTICS = 'analytics';
export const SERVICE_GOOGLE_ADS = 'google-ads';

/**
 * Klaro accepts a cookie as a name, a pattern, or a `[pattern, path, domain]`
 * tuple. It uses these only to *delete* cookies when consent is withdrawn, so
 * patterns are enough — no need to pin path/domain.
 */
export type KlaroCookie = string | RegExp | [RegExp, string, string];

export interface KlaroService {
    name: string;
    title: string;
    description?: string;
    purposes: string[];
    cookies?: KlaroCookie[];
    required?: boolean;
    default?: boolean;
    optOut?: boolean;
    onlyOnce?: boolean;
}

export interface KlaroConfig {
    version: number;
    elementID: string;
    storageMethod: 'cookie' | 'localStorage';
    cookieName: string;
    cookieExpiresAfterDays: number;
    privacyPolicy: string;
    default: boolean;
    mustConsent: boolean;
    acceptAll: boolean;
    hideDeclineAll: boolean;
    hideLearnMore: boolean;
    noticeAsModal: boolean;
    htmlTexts: boolean;
    groupByPurpose: boolean;
    lang: string;
    testing: boolean;
    services: KlaroService[];
    translations: Record<string, unknown>;
}

const EN = {
    privacyPolicyUrl: '/privacy',
    consentNotice: {
        // Kept deliberately short: this is a banner, not the privacy policy. The
        // per-service detail lives in the modal behind "Choose individually".
        // The Google link is here rather than only in the modal so it is visible
        // without a click — audit criterion 5.
        title: 'Cookies',
        description:
            'We measure how the site is used and whether our Google Ads reach the right people. ' +
            'Nothing is stored unless you agree, and you can change your mind any time via “Cookie settings”. ' +
            '<a href="/privacy">Privacy policy</a> · ' +
            `<a href="${GOOGLE_BDR_URL}" target="_blank" rel="noopener noreferrer">How Google uses this data</a>`,
        learnMore: 'Choose individually',
    },
    consentModal: {
        title: 'Cookies and measurement',
        description:
            'Coding for Change is a non-profit student initiative. We keep tracking to the minimum we need to run the site and to report on the Google Ad Grant that funds our outreach. ' +
            'Choose per purpose below — the site works fully either way.',
    },
    purposes: {
        necessary: 'Strictly necessary',
        analytics: 'Audience measurement',
        advertising: 'Advertising measurement',
    },
    [SERVICE_NECESSARY]: {
        title: 'Site basics',
        description:
            'Remembers the language you chose, your decision on this banner, and a random id proving we asked — we are legally required to keep that proof. ' +
            'If you press “save and finish later” on the TechTour registration, it also keeps the answers you have typed so far, in this browser only: nothing reaches us until you send the form, and you can delete them on that page at any time. ' +
            'Exempt from consent under § 25(2) TDDDG because the site cannot work as you asked without it, so there is nothing here to switch off. Never used to track you.',
    },
    // Audit criterion 2: ads personalisation named explicitly, and criteria 4/5:
    // recipient named, with the Google data-responsibility link.
    [SERVICE_GOOGLE_ADS]: {
        title: 'Google Ads conversion tracking',
        description:
            'Lets us see which Google Ads led to a sign-up, contact request or booking. ' +
            'This shares data with <strong>Google Ireland Ltd. and Google LLC (USA)</strong> and may be used by Google for ' +
            '<strong>ads personalisation</strong> and to measure ad performance. We are required to report conversions to keep our Google Ad Grant. ' +
            `Details of how Google handles this data: <a href="${GOOGLE_BDR_URL}" target="_blank" rel="noopener noreferrer">Google Business Data Responsibility</a>.`,
    },
    [SERVICE_ANALYTICS]: {
        title: 'Google Analytics',
        description:
            'Lets us see how the site is used in aggregate, using <strong>Google Analytics</strong>, which sets cookies and shares data with Google. ' +
            'This is optional and off unless you agree. ' +
            'Note that our own visitor counting works differently and needs no cookies at all — it stores nothing on your device and keeps no identifier once you close the tab, so it is not listed here. ' +
            'You can still switch it off entirely with your browser\'s "Do Not Track" or "Global Privacy Control" setting.',
    },
    // Short pair rather than "Accept all"/"Reject all". Permitted: the rules
    // require each button's consequence to be clear and neither to be favoured,
    // not particular wording. Scope stays obvious because "Choose individually"
    // sits directly alongside. Keep both labels similar in length — an "Agree"
    // next to a long, hedged reject label would be exactly the nudging the DSK
    // equal-prominence rule prohibits.
    ok: 'Agree',
    acceptAll: 'Agree',
    acceptSelected: 'Save selection',
    decline: 'Reject',
    save: 'Save',
    close: 'Close',
    service: {
        disableAll: { title: 'Toggle all', description: 'Turn every optional purpose on or off at once.' },
        optOut: { title: '(opt-out)', description: 'Loaded by default — you can switch it off.' },
        required: { title: '(required)', description: 'Needed for the site to work, so it cannot be switched off.' },
        purposes: 'Purposes',
        purpose: 'Purpose',
    },
    poweredBy: '',
};

const DE = {
    privacyPolicyUrl: '/privacy',
    consentNotice: {
        // Siehe Kommentar in EN: absichtlich kurz, Details im Modal.
        title: 'Cookies',
        description:
            'Wir messen, wie die Seite genutzt wird und ob unsere Google Ads die richtigen Leute erreichen. ' +
            'Ohne deine Zustimmung wird nichts gespeichert, und du kannst deine Wahl jederzeit über „Cookie-Einstellungen“ ändern. ' +
            '<a href="/privacy">Datenschutz</a> · ' +
            `<a href="${GOOGLE_BDR_URL}" target="_blank" rel="noopener noreferrer">Wie Google diese Daten nutzt</a>`,
        learnMore: 'Einzeln auswählen',
    },
    consentModal: {
        title: 'Cookies und Messung',
        description:
            'Coding for Change ist eine gemeinnützige Studierendeninitiative. Wir tracken nur das Minimum, das wir brauchen, um die Seite zu betreiben und über den Google Ad Grant zu berichten, der unsere Öffentlichkeitsarbeit finanziert. ' +
            'Wähle unten pro Zweck – die Seite funktioniert in jedem Fall vollständig.',
    },
    purposes: {
        necessary: 'Unbedingt erforderlich',
        analytics: 'Reichweitenmessung',
        advertising: 'Werbemessung',
    },
    [SERVICE_NECESSARY]: {
        title: 'Website-Grundfunktionen',
        description:
            'Speichert die von dir gewählte Sprache, deine Entscheidung zu diesem Banner und eine zufällige Kennung als Nachweis, dass wir gefragt haben – diesen Nachweis müssen wir gesetzlich aufbewahren. ' +
            'Wenn du bei der TechTour-Anmeldung auf „Speichern und später weitermachen“ klickst, kommen deine bisherigen Antworten dazu – nur in diesem Browser: Bei uns kommt nichts an, bevor du das Formular abschickst, und du kannst sie auf der Seite jederzeit löschen. ' +
            'Nach § 25 Abs. 2 TDDDG einwilligungsfrei, weil die Seite ohne das nicht wie gewünscht funktioniert; es gibt hier also nichts abzuschalten. Wird nie zum Tracking verwendet.',
    },
    [SERVICE_GOOGLE_ADS]: {
        title: 'Google Ads Conversion-Tracking',
        description:
            'Zeigt uns, welche Google-Anzeige zu einer Anmeldung, Kontaktanfrage oder Buchung geführt hat. ' +
            'Dabei werden Daten an <strong>Google Ireland Ltd. und Google LLC (USA)</strong> übermittelt und können von Google zur ' +
            '<strong>Personalisierung von Werbung</strong> und zur Messung der Anzeigenleistung genutzt werden. Wir müssen Conversions melden, um unseren Google Ad Grant zu behalten. ' +
            `Wie Google diese Daten verarbeitet: <a href="${GOOGLE_BDR_URL}" target="_blank" rel="noopener noreferrer">Google Business Data Responsibility</a>.`,
    },
    [SERVICE_ANALYTICS]: {
        title: 'Google Analytics',
        description:
            'Zeigt uns in aggregierter Form, wie die Seite genutzt wird – über <strong>Google Analytics</strong>, das Cookies setzt und Daten an Google übermittelt. ' +
            'Das ist optional und ohne deine Zustimmung ausgeschaltet. ' +
            'Unsere eigene Besucherzählung funktioniert anders und braucht überhaupt keine Cookies – sie speichert nichts auf deinem Gerät und behält keine Kennung, sobald du den Tab schließt; deshalb steht sie hier nicht. ' +
            'Du kannst sie über „Do Not Track" oder „Global Privacy Control" in deinem Browser vollständig abschalten.',
    },
    // „Zustimmen" / „Ablehnen" — die übliche Paarung auf deutschen Seiten.
    // Siehe Kommentar in EN zur Gleichwertigkeit.
    ok: 'Zustimmen',
    acceptAll: 'Zustimmen',
    acceptSelected: 'Auswahl speichern',
    decline: 'Ablehnen',
    save: 'Speichern',
    close: 'Schließen',
    service: {
        disableAll: { title: 'Alle umschalten', description: 'Alle optionalen Zwecke gleichzeitig ein- oder ausschalten.' },
        optOut: { title: '(Opt-out)', description: 'Wird standardmäßig geladen – du kannst es abschalten.' },
        required: { title: '(erforderlich)', description: 'Für den Betrieb der Seite nötig und daher nicht abschaltbar.' },
        purposes: 'Zwecke',
        purpose: 'Zweck',
    },
    poweredBy: '',
};

/**
 * Build the Klaro config for a locale.
 *
 * `default: false` + no `optOut` on any service is audit criterion 7: nothing
 * loads or stores until the visitor says yes. `hideDeclineAll: false` keeps
 * "Reject all" on the first screen with equal prominence — the German DSK
 * position, and the single most-fined banner mistake when it's missing.
 */
export function buildKlaroConfig(locale: Locale): KlaroConfig {
    return {
        version: CONSENT_CONFIG_VERSION,
        elementID: 'klaro',
        storageMethod: 'cookie',
        cookieName: 'cfc_consent',
        cookieExpiresAfterDays: 180, // ~6 months — see RETENTION_DAYS in attribution.ts
        privacyPolicy: '/privacy',
        default: false, // nothing on by default
        mustConsent: false, // no cookie wall — the site stays usable while undecided
        acceptAll: true,
        hideDeclineAll: false, // "Reject all" must be as reachable as "Accept all"
        hideLearnMore: false,
        noticeAsModal: false,
        htmlTexts: true, // needed for the Google BDR link (criterion 5)
        groupByPurpose: true,
        lang: locale,
        testing: false,
        services: [
            {
                // Declared purely for transparency: `required` means Klaro shows
                // it as always-on and offers no toggle. It carries no consent —
                // these items are § 25(2) exempt — but a visitor opening the
                // settings deserves to see what runs regardless, rather than a
                // list that silently omits it.
                //
                // NOTE: adding this does NOT warrant a CONSENT_CONFIG_VERSION
                // bump, even though CLAUDE.md says to bump when a service is
                // added. That rule exists to re-ask when new *processing* appears
                // under an already-consented purpose. This adds none — it only
                // describes storage that was always exempt.
                //
                // Same reasoning for `cfc-techtour-draft` (the saved TechTour
                // registration, `components/forms/CmsForm.tsx`), listed in the
                // text above: it is written only when the visitor presses "save
                // and finish later", never on its own, and it stays on their
                // device. § 25(2) TDDDG, so no consent to re-ask for — only the
                // Datenschutz storage table needs the matching row.
                name: SERVICE_NECESSARY,
                title:
                    locale === 'de'
                        ? DE[SERVICE_NECESSARY].title
                        : EN[SERVICE_NECESSARY].title,
                purposes: ['necessary'],
                // Deliberately NO `cookies` list. Verified in the vendored
                // bundle that `updateServiceStorage` uses that field for exactly
                // one thing — deleting the named cookies when the service is
                // *not* consented (`if (!t && ...)`). A `required` service is
                // always consented, so the list would be inert; and naming
                // `cfc_consent` there would mean any edge case that treated this
                // as unconsented would delete Klaro's own consent cookie and
                // re-show the banner on every page load. The three cookies are
                // described in the text above and listed in the Datenschutz
                // table, which is where a visitor actually reads them.
                required: true,
                default: true,
            },
            {
                name: SERVICE_ANALYTICS,
                title: locale === 'de' ? DE[SERVICE_ANALYTICS].title : EN[SERVICE_ANALYTICS].title,
                purposes: ['analytics'],
                // GA4's cookies. Our own measurement uses sessionStorage, not
                // cookies, so it has nothing to list here — it's cleared by the
                // consent listener in `analytics.ts` instead.
                cookies: [/^_ga/, '_gid'],
                required: false,
                default: false,
            },
            {
                name: SERVICE_GOOGLE_ADS,
                title: locale === 'de' ? DE[SERVICE_GOOGLE_ADS].title : EN[SERVICE_GOOGLE_ADS].title,
                purposes: ['advertising'],
                cookies: [/^_gcl/],
                required: false,
                default: false,
            },
        ],
        translations: { en: EN, de: DE, zz: EN },
    };
}
