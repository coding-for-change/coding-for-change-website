import type { Field } from 'payload';

/**
 * Reviewer's verdict, score and notes on a form submission (a membership
 * application or a TechTour registration). Set in the review workspace
 * (/admin/review) or in the submission's sidebar; exported alongside the
 * answers by /api/submissions-export.xlsx.
 *
 * One set per submission, not per reviewer: the team reviews under a shared
 * login, so the last edit is the one that stands.
 */
export const REVIEW_STATUSES = [
  { label: 'Unreviewed', value: 'unreviewed' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Unsure', value: 'unsure' },
  { label: 'Rejected', value: 'rejected' },
] as const;

/** The score scale: whole numbers, 1 (weak) to 10 (outstanding). */
export const REVIEW_SCORE_MIN = 1;
export const REVIEW_SCORE_MAX = 10;

export const reviewFields: Field[] = [
  {
    name: 'reviewStatus',
    type: 'select',
    label: 'Review status',
    defaultValue: 'unreviewed',
    options: [...REVIEW_STATUSES],
    admin: {
      position: 'sidebar',
      description: 'Your verdict on this applicant.',
    },
  },
  {
    name: 'reviewScore',
    type: 'number',
    label: 'Score (1–10)',
    min: REVIEW_SCORE_MIN,
    max: REVIEW_SCORE_MAX,
    validate: (value: number | null | undefined) =>
      value == null ||
      (Number.isInteger(value) && value >= REVIEW_SCORE_MIN && value <= REVIEW_SCORE_MAX) ||
      `A whole number from ${REVIEW_SCORE_MIN} to ${REVIEW_SCORE_MAX}.`,
    admin: {
      position: 'sidebar',
      step: 1,
      description: 'How strong the applicant is, from 1 (weak) to 10 (outstanding). Leave empty until reviewed.',
    },
  },
  {
    name: 'reviewNotes',
    type: 'textarea',
    label: 'Notes on the applicant',
    admin: {
      position: 'sidebar',
      description: 'Internal notes — never shown to the applicant. Included in the Excel export.',
    },
  },
];
