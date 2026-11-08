/**
 * Where our members study and what, in percent – the bars in the talent
 * section of /partners (names: `pages.partnersUnis` / `partnersDegrees`).
 * Three bars per chart, so the two charts stand level; fold anything smaller
 * into the last one. Drawn in the order given here.
 *
 * Counted from the 17 profiles on /team in November 2026 (one entry per
 * person: Mauritz under TUM computer science, Tristan under computer science,
 * TUM-BWL under business, mechanical engineering under "& other"). Replace
 * with the figures for all members when they are counted. Each list should
 * add up to 100.
 */
export const MEMBER_STATS = {
    universities: [
        { key: 'tum', share: 70 },
        { key: 'lmu', share: 18 },
        { key: 'hm', share: 12 },
    ],
    degrees: [
        { key: 'cs', share: 53 },
        { key: 'is', share: 18 },
        { key: 'business', share: 29 },
    ],
} as const;
