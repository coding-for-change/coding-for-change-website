import 'server-only';
import type { CmsBlogPost, CmsProject, TechTourManageView } from '@/api/types';

// Server-side CMS fetching. Unlike the browser client (`@/api/client`, which
// hits the relative `/api` proxied by the outer Express server), server
// components run inside the `inner` container and talk to the CMS container
// directly. `CMS_INTERNAL_URL` points at that internal address in Docker; the
// localhost fallback is for running `next dev` outside compose.
const BASE = process.env.CMS_INTERNAL_URL ?? 'http://cms:3000/api';

// Cap how long a page render waits on the CMS. Every page fetches through here,
// so without a timeout a slow/down CMS would hang the whole SSR response rather
// than rendering with empty data.
const FETCH_TIMEOUT_MS = 5000;

interface PaginatedResponse<T> {
    docs: T[];
}

function buildUrl(path: string, params: Record<string, string>): string {
    const url = new URL(`${BASE}/${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
}

async function getJson<T>(url: string): Promise<T | null> {
    try {
        const res = await fetch(url, {
            cache: 'no-store',
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        if (!(res.headers.get('content-type') ?? '').includes('application/json')) return null;
        return (await res.json()) as T;
    } catch {
        // Network error, timeout, CMS down, bad JSON — degrade to empty so the
        // page still renders instead of throwing a 500.
        return null;
    }
}

/** Fetch a collection's docs. Returns [] on any failure. */
export async function fetchCollection<T>(
    slug: string,
    locale = 'en',
    params?: Record<string, string>
): Promise<T[]> {
    const data = await getJson<PaginatedResponse<T>>(
        buildUrl(slug, { locale, limit: '200', ...params })
    );
    return data?.docs ?? [];
}

/** Fetch a global. Returns null on any failure. */
export async function fetchGlobal<T>(slug: string, locale = 'en'): Promise<T | null> {
    return getJson<T>(buildUrl(`globals/${slug}`, { locale }));
}

/** Fetch a single project by slug (depth=2 to populate image + gallery media). */
export async function fetchProjectBySlug(
    slug: string,
    locale = 'en'
): Promise<CmsProject | null> {
    const data = await getJson<PaginatedResponse<CmsProject>>(
        buildUrl('projects', {
            locale,
            depth: '2',
            limit: '1',
            'where[slug][equals]': slug,
        })
    );
    return data?.docs?.[0] ?? null;
}

/** Fetch a single blog post by slug (depth=2 to populate author/project/media). */
export async function fetchPostBySlug(
    slug: string,
    locale = 'en'
): Promise<CmsBlogPost | null> {
    const data = await getJson<PaginatedResponse<CmsBlogPost>>(
        buildUrl('blog-posts', {
            locale,
            depth: '2',
            limit: '1',
            'where[slug][equals]': slug,
        })
    );
    return data?.docs?.[0] ?? null;
}

/**
 * A registrant's own TechTour view behind their link (/techtour/manage).
 * Null for a token that opens nothing – or when the CMS cannot be reached; the
 * page says the same to both.
 */
export async function fetchTechTourManage(
    token: string,
    locale = 'en'
): Promise<TechTourManageView | null> {
    return getJson<TechTourManageView>(buildUrl('techtour/manage', { token, locale }));
}
