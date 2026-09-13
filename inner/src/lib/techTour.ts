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
