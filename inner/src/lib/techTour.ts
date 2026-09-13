import type { CmsTechTour } from '../api/types';

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
