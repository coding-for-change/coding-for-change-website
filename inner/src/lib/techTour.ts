import type { CmsTechTour, CmsTechTourVisibility } from '../api/types';

/**
 * The page's publishing state from the CMS. Missing (older data or CMS down)
 * counts as 'unlisted': linked, but not indexed and not in the sitemap — the
 * safe side while content is still being written.
 */
export const techTourVisibility = (tt: CmsTechTour | null | undefined): CmsTechTourVisibility =>
    tt?.visibility ?? 'unlisted';

/** Show the "TechTour 2026" link in navigation and footer. */
export const techTourListed = (tt: CmsTechTour | null | undefined): boolean =>
    techTourVisibility(tt) !== 'hidden';

/** Let search engines index the page. */
export const techTourIndexable = (tt: CmsTechTour | null | undefined): boolean =>
    techTourVisibility(tt) === 'public';

/**
 * Whether TechTour registration is open right now: the admin's "registration
 * open" switch, and — if a deadline is set — the deadline has not passed.
 * Shared by the TechTour page (form vs. closed notice) and the join page
 * (whether to offer the "also register for the TechTour" box at all).
 */
export const techTourRegistrationOpen = (
    tt: CmsTechTour | null | undefined,
    now: number
): boolean => {
    if (tt?.registrationOpen === false) return false;
    if (!tt?.registrationDeadline) return true;
    const deadline = new Date(tt.registrationDeadline).getTime();
    return Number.isNaN(deadline) || now <= deadline;
};

/**
 * "9.–13. November 2026" / "9–13 November 2026" — the span the tour runs.
 *
 * Built by hand rather than with `Intl.DateTimeFormat.formatRange`, which
 * renders the same range differently in Node and in the browser ("9–13" vs
 * "9 – 13"): on a server-rendered page that is a hydration mismatch, and React
 * throws the whole subtree away and re-renders it. The pieces come from
 * `formatToParts` so the day's own punctuation (the German trailing dot)
 * follows the locale rather than being hard-coded.
 */
export const formatDateRange = (start: Date, end: Date, locale: string): string => {
    const fmt = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    if (start.getTime() === end.getTime()) return fmt.format(end);
    // Different month or year: both ends have to be spelled out in full.
    if (start.getMonth() !== end.getMonth() || start.getFullYear() !== end.getFullYear()) {
        return `${fmt.format(start)} – ${fmt.format(end)}`;
    }
    // Same month: only the first day, keeping whatever punctuation the locale
    // puts straight after a day number ("9." in German, "9" in English).
    const parts = fmt.formatToParts(end);
    const dayAt = parts.findIndex((part) => part.type === 'day');
    const after = dayAt >= 0 ? parts[dayAt + 1] : undefined;
    const suffix =
        after?.type === 'literal' ? (after.value.match(/^[^\s\d]+/)?.[0] ?? '') : '';
    const startDay = new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(start);
    return `${startDay}${suffix}\u2013${fmt.format(end)}`;
};
