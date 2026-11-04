import type { Field } from 'payload';

/**
 * A TechTour registration's answer from the host companies: per evening key,
 * what the host decided through its share link (endpoints/share.ts) – e.g.
 * `{ "wed-quantumblack": { "decision": "admitted", "by": "…@quantco.com",
 * "at": "…" } }`. Kept on the registration so it is deleted with it, as the
 * Datenschutz says. Shown in the review workspace.
 *
 * Written only by the share links and the waitlist (lib/share/registrations.ts,
 * with `overrideAccess`). Nobody else may write it: saving a registration's
 * edit view in the admin sends every field as it was when the view was
 * opened – without this, a host decision made meanwhile would be put back to
 * the old value. With update access off, Payload keeps the stored value.
 */
export const hostDecisionsField: Field = {
  name: 'hostDecisions',
  type: 'json',
  label: 'Host decisions',
  access: { update: () => false },
  admin: {
    readOnly: true,
    description:
      'What each evening’s host company decided through its share link: admitted or declined, by whom, when.',
  },
};
