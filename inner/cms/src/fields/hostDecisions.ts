import type { Field } from 'payload';

/**
 * A TechTour registration's answer from the host companies: per evening key,
 * what the host decided through its share link (endpoints/share.ts) – e.g.
 * `{ "wed-quantumblack": { "decision": "admitted", "by": "…@quantco.com",
 * "at": "…" } }`. Kept on the registration so it is deleted with it, as the
 * Datenschutz says. Shown in the review workspace.
 */
export const hostDecisionsField: Field = {
  name: 'hostDecisions',
  type: 'json',
  label: 'Host decisions',
  admin: {
    readOnly: true,
    description:
      'What each evening’s host company decided through its share link: admitted or declined, by whom, when.',
  },
};
