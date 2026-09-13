import type { Field } from 'payload';

/**
 * Reviewer's verdict and notes on a form submission (a membership application
 * or a TechTour registration). Editable by admins in the submission's sidebar;
 * exported alongside the answers by /api/submissions-export.xlsx.
 */
export const REVIEW_STATUSES = [
  { label: 'Unreviewed', value: 'unreviewed' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Unsure', value: 'unsure' },
  { label: 'Rejected', value: 'rejected' },
] as const;

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
    name: 'reviewNotes',
    type: 'textarea',
    label: 'Notes on the applicant',
    admin: {
      position: 'sidebar',
      description: 'Internal notes — never shown to the applicant. Included in the Excel export.',
    },
  },
];
