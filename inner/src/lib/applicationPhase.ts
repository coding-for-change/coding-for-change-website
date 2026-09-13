/**
 * The membership application round: every dated step from "come and meet us"
 * to "the project is running", plus the rule for whether the application form
 * is open right now.
 *
 * Dates are the single source of truth for the Join page. Each step's window
 * decides how the timeline draws it (done / current / upcoming), and the
 * application deadline decides whether the form or the "notify me" waitlist
 * shows — so nobody has to redeploy at midnight to close a round. The wording
 * for each step lives in `i18n/translations.ts` (`join.phase.steps`), keyed by
 * the ids below.
 *
 * To run the next round: update the dates here and the step copy in the
 * translations. Offsets are written out explicitly (Europe/Berlin: +02:00
 * until the clocks change on 25 Oct 2026, +01:00 after) so the result does not
 * depend on the server's time zone.
 */

export type ApplicationStepId =
    | 'fair'
    | 'apply'
    | 'invitation'
    | 'interviews'
    | 'onboarding'
    | 'project';

export interface ApplicationStep {
    id: ApplicationStepId;
    /** Start of the step's window (ISO 8601 with offset). Omit for "already running". */
    start?: string;
    /** End of the window (ISO 8601 with offset). */
    end: string;
}

/** Round label used in the section kicker, e.g. "Winter 2026/27". */
export const APPLICATION_ROUND = { en: 'Winter 2026/27', de: 'Winter 2026/27' } as const;

/** Applications are accepted up to and including this instant. */
export const APPLICATION_DEADLINE = '2026-10-30T23:59:59+01:00';

export const APPLICATION_STEPS: ApplicationStep[] = [
    // Student Club Fair — meet the team.
    { id: 'fair', start: '2026-10-21T10:00:00+02:00', end: '2026-10-21T17:00:00+02:00' },
    // Applications open now, hard deadline 30 Oct 23:59.
    { id: 'apply', end: APPLICATION_DEADLINE },
    // Interview invitations go out within two days of the deadline.
    { id: 'invitation', start: '2026-10-31T00:00:00+01:00', end: '2026-11-01T23:59:59+01:00' },
    // Interview week.
    { id: 'interviews', start: '2026-11-02T00:00:00+01:00', end: '2026-11-08T23:59:59+01:00' },
    // Onboarding event + first team meeting: Mon 9 / Tue 10 / Wed 11 Nov.
    { id: 'onboarding', start: '2026-11-09T00:00:00+01:00', end: '2026-11-11T23:59:59+01:00' },
    // Two-month project phase, mid-November to mid-January.
    { id: 'project', start: '2026-11-16T00:00:00+01:00', end: '2027-01-15T23:59:59+01:00' },
];

/**
 * Manual override for the form. Leave `null` so the deadline decides; set
 * 'open' to keep accepting late applications after the deadline, or 'closed'
 * to stop early. Either way the timeline keeps drawing from the dates.
 */
export const APPLICATIONS_OVERRIDE: 'open' | 'closed' | null = null;

export type StepState = 'done' | 'current' | 'upcoming';

const ms = (iso: string) => new Date(iso).getTime();

/** Where a step sits relative to `now` (epoch ms). */
export const stepState = (step: ApplicationStep, now: number): StepState => {
    if (now > ms(step.end)) return 'done';
    if (step.start && now < ms(step.start)) return 'upcoming';
    return 'current';
};

/** Whether the application form (rather than the waitlist) should show. */
export const applicationsOpen = (now: number): boolean => {
    if (APPLICATIONS_OVERRIDE) return APPLICATIONS_OVERRIDE === 'open';
    return now <= ms(APPLICATION_DEADLINE);
};

/** Whole days left until the deadline, never negative. Same-day counts as 1. */
export const daysUntilDeadline = (now: number): number =>
    Math.max(0, Math.ceil((ms(APPLICATION_DEADLINE) - now) / 86_400_000));
