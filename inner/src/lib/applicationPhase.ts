/**
 * The membership application round: the three dated steps from applying to
 * being in, plus the rule for whether the application form is open right now.
 *
 * Dates are the single source of truth for /join and /join/apply. Each step's
 * window decides how the steps are drawn (done / current / upcoming), and the
 * opening date and deadline decide whether /join/apply shows the form or the
 * "notify me" waitlist – so nobody has to redeploy at midnight to open or close
 * a round. The wording for each step lives in `i18n/translations.ts`
 * (`join.steps`), keyed by the ids below.
 *
 * To run the next round: update the dates here, `APPLICATION_ROUND`, and the
 * dates written into the copy (`join.window`, `join.status.upcoming`,
 * `join.steps.*.timing`, `join.closing.text`, `join.apply.lead.upcoming` and
 * `join.upcomingTitle`). Offsets are written out explicitly (Europe/Berlin:
 * +02:00 until the clocks change on 25 Oct 2026, +01:00 after) so the result
 * does not depend on the server's time zone.
 */

export type ApplicationStepId = 'apply' | 'interview' | 'admission';

export interface ApplicationStep {
    id: ApplicationStepId;
    /** Start of the step's window (ISO 8601 with offset). Omit for "already running". */
    start?: string;
    /** End of the window (ISO 8601 with offset). */
    end: string;
}

/** Round label used in kickers and the apply page title, e.g. "Winter 2026/27". */
export const APPLICATION_ROUND = { en: 'Winter 2026/27', de: 'Winter 2026/27' } as const;

/** Applications are accepted from this instant on. Before it the page names the date. */
export const APPLICATION_OPENS = '2026-10-05T00:00:00+02:00';

/** Applications are accepted up to and including this instant. */
export const APPLICATION_DEADLINE = '2026-10-31T23:59:59+01:00';

export const APPLICATION_STEPS: ApplicationStep[] = [
    // The form is open 5–31 Oct; invitations go out within two days of the deadline.
    { id: 'apply', start: APPLICATION_OPENS, end: APPLICATION_DEADLINE },
    // Interview week: a talk plus a small (vibe-)coding challenge.
    { id: 'interview', start: '2026-11-02T00:00:00+01:00', end: '2026-11-08T23:59:59+01:00' },
    // New-joiner event on Mon 9, Tue 10 or Wed 11 Nov: projects introduced, teams matched.
    { id: 'admission', start: '2026-11-09T00:00:00+01:00', end: '2026-11-11T23:59:59+01:00' },
];

/**
 * Manual override for the form. Leave `null` so the dates decide; set 'open'
 * to accept applications outside the window (early, or late after the
 * deadline), or 'closed' to stop early. Either way the steps keep drawing
 * from the dates.
 */
export const APPLICATIONS_OVERRIDE: 'open' | 'closed' | null = null;

/**
 * 'upcoming' – the round has not started, the page names the opening date;
 * 'open' – the form shows; 'closed' – the round is over (or stopped early).
 */
export type ApplicationStatus = 'upcoming' | 'open' | 'closed';

export type StepState = 'done' | 'current' | 'upcoming';

const ms = (iso: string) => new Date(iso).getTime();

const berlinDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

/**
 * The calendar day an instant falls on in Munich, as a day number. Counting
 * in calendar days rather than 24-hour blocks keeps the count right across
 * the clock change on 25 Oct: a 23:59 deadline in winter time is 25 hours
 * away from midnight in summer time, which would otherwise round up to an
 * extra day for the first hour of every day.
 */
const berlinDay = (t: number): number => {
    const [y, m, d] = berlinDate.format(t).split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** Where a step sits relative to `now` (epoch ms). */
export const stepState = (step: ApplicationStep, now: number): StepState => {
    if (now > ms(step.end)) return 'done';
    if (step.start && now < ms(step.start)) return 'upcoming';
    return 'current';
};

/** Where the round stands at `now` (epoch ms). */
export const applicationStatus = (now: number): ApplicationStatus => {
    if (APPLICATIONS_OVERRIDE) return APPLICATIONS_OVERRIDE;
    if (now < ms(APPLICATION_OPENS)) return 'upcoming';
    return now <= ms(APPLICATION_DEADLINE) ? 'open' : 'closed';
};

/** Whether the application form (rather than the waitlist) should show. */
export const applicationsOpen = (now: number): boolean => applicationStatus(now) === 'open';

/** Days left to apply, today included: 1 on the deadline day, 0 once it has passed. */
export const daysUntilDeadline = (now: number): number =>
    now > ms(APPLICATION_DEADLINE) ? 0 : berlinDay(ms(APPLICATION_DEADLINE)) - berlinDay(now) + 1;

/** Days until the form opens: 1 the day before, 0 once it is open. */
export const daysUntilOpening = (now: number): number =>
    Math.max(0, berlinDay(ms(APPLICATION_OPENS)) - berlinDay(now));
