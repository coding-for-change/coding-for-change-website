import { NextResponse, type NextRequest } from 'next/server';
import { NO_TAGS_HEADER, isPrivatePath } from '@/lib/privatePages';

/**
 * Honour `?lang=de` / `?lang=en` so a URL can pin the render language.
 *
 * Why this exists: locale was resolved purely from the `cfc-locale` cookie,
 * defaulting to English, with the client swapping to German after hydration if
 * `navigator.language` looked German. That left no way for an inbound link to
 * ask for a language — which broke the German Google Ads:
 *
 *   - a German ad could only point at a page that server-rendered English,
 *     and an ad-to-landing-page language mismatch drives Quality Score down.
 *     Ad Grants requires every active keyword to stay at QS >= 3, so this was a
 *     compliance problem, not only a cosmetic one.
 *   - German speakers on English-configured devices (common at TUM) got English
 *     regardless of the ad they clicked.
 *   - every German visitor saw a flash of English before hydration.
 *
 * Implementation notes:
 *
 *   - We **rewrite**, not redirect. A redirect would add a hop on every ad click
 *     and risk mangling the tracking parameters.
 *   - The cookie is set on the response *and* on the forwarded request, so the
 *     very same render already sees it — `cookies()` in a server component reads
 *     request cookies, so setting only the response cookie would leave the first
 *     paint in the wrong language and defeat the point.
 *   - `lang` is deliberately **not** stripped from the URL. `attribution.ts`
 *     already rewrites the address bar client-side to drop tracking params, and
 *     touching the query string here would mean re-implementing that carefully
 *     enough not to lose `gclid` — which Google Ads needs for conversion
 *     attribution. Not worth the risk for a cosmetic gain.
 */

const LOCALE_COOKIE = 'cfc-locale';
const ONE_YEAR = 60 * 60 * 24 * 365;

export function middleware(request: NextRequest) {
    const requested = request.nextUrl.searchParams.get('lang');
    const lang = requested === 'de' || requested === 'en' ? requested : null;
    // A page behind a personal link renders without the Google tag
    // (lib/privatePages.ts).
    const noTags = isPrivatePath(request.nextUrl.pathname);
    if (!lang && !noTags) {
        return NextResponse.next();
    }

    const headers = new Headers(request.headers);
    if (noTags) headers.set(NO_TAGS_HEADER, '1');
    if (!lang) {
        return NextResponse.next({ request: { headers } });
    }

    // Make the current render see the locale, not just the next one.
    const forwarded = new Map(
        request.cookies.getAll().map((c) => [c.name, c.value])
    );
    forwarded.set(LOCALE_COOKIE, lang);
    headers.set(
        'cookie',
        Array.from(forwarded, ([name, value]) => `${name}=${value}`).join('; ')
    );

    const response = NextResponse.next({ request: { headers } });

    // Persist it so later navigations (and the client's own reads) agree.
    response.cookies.set({
        name: LOCALE_COOKIE,
        value: lang,
        path: '/',
        maxAge: ONE_YEAR,
        sameSite: 'lax',
    });

    return response;
}

export const config = {
    /*
     * Only page requests. Running on assets, the CMS proxy or the Next internals
     * would be pure overhead — and `/api` belongs to the CMS, which must not have
     * its cookies rewritten underneath it.
     */
    matcher: ['/((?!api|admin|_next|media|3d|favicon.ico|images|.*\\.[\\w]+$).*)'],
};
