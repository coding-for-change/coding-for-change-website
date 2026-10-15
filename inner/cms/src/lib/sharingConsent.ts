/**
 * Whether a TechTour registration may go to the host companies: only when the
 * person ticked the form's `hostSharing` box – the consent to pass their
 * details and CV on to the host companies of the evenings they picked
 * (Datenschutz section 5a). The tick is read from the registration's own record
 * (`agreedTo`, fields/submissionRecord.ts), which nobody can edit afterwards.
 *
 * Shared by the host share links (lib/share/registrations.ts), which leave out
 * everyone else, and the review workspace, which says so.
 */

/** The name of the form's consent box for passing a registration on to the hosts. */
export const SHARING_CONSENT_FIELD = 'hostSharing';

export const consentedToSharing = (s: { agreedTo?: unknown }): boolean =>
  Array.isArray(s.agreedTo) &&
  s.agreedTo.some((e) => (e as { field?: unknown } | null)?.field === SHARING_CONSENT_FIELD);
