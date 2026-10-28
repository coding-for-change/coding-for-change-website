import type { Field } from 'payload';

/**
 * Which version of a form a submission was sent through. Empty for the form as
 * the admin defines it; `speedrun` for the short membership application at
 * /join/speedrun (components/showcase/JoinSpeedrun.tsx on the site). That page
 * posts to the same "application" form so its applicants are reviewed in the
 * same list – but it asks only some of the form's questions, adds a few of its
 * own and takes no CV, and this is how a reviewer tells the two apart.
 *
 * The site sends it on create; nobody changes it afterwards. A value that is
 * not one of the options is refused, like any select.
 */
export const SUBMISSION_SOURCES = [{ label: 'Speedrun (/join/speedrun)', value: 'speedrun' }] as const;

export type SubmissionSource = (typeof SUBMISSION_SOURCES)[number]['value'];

export const submissionSourceField: Field = {
  name: 'source',
  type: 'select',
  label: 'Submitted via',
  options: [...SUBMISSION_SOURCES],
  access: { update: () => false },
  admin: {
    position: 'sidebar',
    readOnly: true,
    description:
      'Empty = the full form. "Speedrun" = the short application at /join/speedrun: no CV, only some of the questions.',
  },
};
