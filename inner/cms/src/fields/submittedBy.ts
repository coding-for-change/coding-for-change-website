import type { Field, FieldHook } from 'payload';
import { roleOf } from '../access/roles';

/**
 * The signed-in account a form submission came from: set by the server when
 * it is created, never by what the browser sends and never changed after
 * that. Null for the anonymous public forms. The onboarding form (a form
 * with "Requires sign-in", see the forms' `requiresLogin`) relies on it to
 * know whose answers these are.
 *
 * Field access refuses the value from every API request, so on create it is
 * the signed-in `users` account; only server code that passes
 * overrideAccess can set it to someone else (work package 3: a hook that
 * creates a submission for a member).
 */

const idOf = (v: unknown): number | string | null => {
  if (v == null) return null;
  if (typeof v === 'object') return ((v as { id?: number | string }).id ?? null) as number | string | null;
  return v as number | string;
};

const stamp: FieldHook = ({ operation, req, value, originalDoc }) => {
  if (operation === 'create') return idOf(value) ?? (roleOf(req.user) ? req.user!.id : null);
  return idOf((originalDoc as { submittedBy?: unknown } | undefined)?.submittedBy);
};

export const submittedByField: Field = {
  name: 'submittedBy',
  label: 'Submitted by',
  type: 'relationship',
  relationTo: 'users',
  index: true,
  access: { create: () => false, update: () => false },
  hooks: { beforeChange: [stamp] },
  admin: {
    position: 'sidebar',
    readOnly: true,
    description: 'The signed-in account this came from. Empty for the public forms.',
  },
};

/** "Requires sign-in" on a form definition. */
export const requiresLoginField: Field = {
  name: 'requiresLogin',
  label: 'Requires sign-in',
  type: 'checkbox',
  defaultValue: false,
  admin: {
    position: 'sidebar',
    description:
      'Only signed-in members can send this form, and each answer is stored with their account. For the onboarding form.',
  },
};
