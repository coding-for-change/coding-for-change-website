import type { CollectionBeforeOperationHook } from 'payload';
import { APIError } from 'payload';

/**
 * Spam protection without a third party. The site's forms carry one text box
 * that people never see (components/forms/CmsForm.tsx) and send whatever is in
 * it as `hp`. Scripts that fill in every field they find fill that one too, and
 * a submission that arrives with it filled is refused before anything is
 * stored. No reCAPTCHA, nothing loaded from anyone else, nothing stored on the
 * device – so nothing here needs consent (Datenschutz, section 5a).
 */
export const HONEYPOT_KEY = 'hp';

export const rejectHoneypot: CollectionBeforeOperationHook = ({ args, operation }) => {
  if (operation !== 'create') return args;
  const data = (args as { data?: Record<string, unknown> }).data;
  if (!data || !(HONEYPOT_KEY in data)) return args;
  const filled = String(data[HONEYPOT_KEY] ?? '').trim() !== '';
  // Not a field of the collection – never stored either way.
  delete data[HONEYPOT_KEY];
  if (filled) throw new APIError('This submission could not be saved.', 400);
  return args;
};
