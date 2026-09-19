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

/**
 * A formatted date split at its year, so a layout too narrow for the year can
 * drop it without formatting the date a second way: `text` is the date and
 * `year` is the year with whatever separates it from the rest (" 2026"), so
 * `text + year` is exactly the undivided string.
 *
 * `year` is empty when the year cannot be lifted off cleanly — a range that
 * spans two of them, or a locale that does not put the year last. The caller
 * then shows the string whole rather than something wrong.
 */
export interface SplitDate {
    text: string;
    year: string;
}

const splitAtYear = (parts: Intl.DateTimeFormatPart[]): SplitDate => {
    const whole = parts.map((part) => part.value).join('');
    const at = parts.findIndex((part) => part.type === 'year');
    // Only a trailing year can be lifted off. A locale that leads with it
    // would drag the rest of the date along behind it.
    const trailing = at >= 0 && parts.slice(at + 1).every((part) => part.type === 'literal');
    if (!trailing) return { text: whole, year: '' };
    // Whatever literal sits in front of the year is its separator, and goes
    // with it — otherwise dropping the year leaves a space hanging.
    const from = at > 0 && parts[at - 1].type === 'literal' ? at - 1 : at;
    return {
        text: parts
            .slice(0, from)
            .map((part) => part.value)
            .join(''),
        year: parts
            .slice(from)
            .map((part) => part.value)
            .join(''),
    };
};

/** "31. Oktober" + " 2026" — one date, split at its year. */
export const formatDateSplit = (date: Date, locale: string): SplitDate =>
    splitAtYear(
        new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).formatToParts(date)
    );

/**
 * `formatDateRange` split at its year. The range itself is built by that
 * function, not rebuilt here, so the two can never drift apart: this only
 * peels the year off the end of what it returns.
 *
 * Which is why only a range inside one month is ever split. Spanning two,
 * `formatDateRange` spells both ends out in full — "30. Oktober 2026 – 3.
 * November 2026" — and taking the year off the end of that would leave the
 * other one stranded in the middle. Rebuilding the range without years
 * instead would mean two ways of writing it, and the wide layout's would
 * change; a tour that runs over a month's end simply keeps its years.
 */
export const formatDateRangeSplit = (start: Date, end: Date, locale: string): SplitDate => {
    const whole = formatDateRange(start, end, locale);
    const oneMonth =
        start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
    if (!oneMonth) return { text: whole, year: '' };
    const year = formatDateSplit(end, locale).year;
    if (!year || !whole.endsWith(year)) return { text: whole, year: '' };
    return { text: whole.slice(0, -year.length), year };
};
