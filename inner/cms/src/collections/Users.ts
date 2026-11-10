import { APIError, type CollectionBeforeLoginHook, type CollectionConfig, type Field, type FieldAccess } from 'payload';
import { fieldIsAdmin, hasAdminRole, hasEditorRole, isAdmin, isAdminOrSelf, roleOf, ROLES } from '../access/roles';

/**
 * Password sign-in is the board's emergency access only: everyone else signs
 * in with Google (endpoints/googleAuth.ts), which never runs this hook. It
 * also guards "reset password", which signs the user in at the end.
 */
const onlyAdminsByPassword: CollectionBeforeLoginHook = ({ user }) => {
  if (!hasAdminRole({ ...user, collection: 'users' })) {
    throw new APIError('Password sign-in is for admins only. Please use "Sign in with Google".', 403, null, true);
  }
  return user;
};

/** An admin, or the account's own user (a member reading their own data on the onboarding page). */
const fieldIsAdminOrSelf: FieldAccess = ({ req, doc }) =>
  hasAdminRole(req.user) ||
  (roleOf(req.user) !== null && doc != null && String((doc as { id?: unknown }).id) === String(req.user?.id));

/** What a member brings along: readable by admins and the member, set by admins (or the server for them). */
const memberAccess = { read: fieldIsAdminOrSelf, create: fieldIsAdmin, update: fieldIsAdmin };

/**
 * The member's data, kept on their account (there is no separate members
 * collection): filled from the application when the board creates the account
 * in /admin/onboarding (endpoints/onboarding.ts), later from the onboarding
 * form. `email` is the association address; the private one is
 * `privateEmail`. The public face is the `team` entry in `teamProfile`.
 */
const memberFields: Field[] = [
  {
    type: 'row',
    fields: [
      { name: 'firstName', type: 'text', access: memberAccess, admin: { width: '50%' } },
      { name: 'lastName', type: 'text', access: memberAccess, admin: { width: '50%' } },
    ],
  },
  {
    type: 'row',
    fields: [
      {
        name: 'privateEmail',
        type: 'email',
        access: memberAccess,
        admin: { width: '50%', description: 'From the application; the recovery address of the Google account.' },
      },
      { name: 'githubUsername', label: 'GitHub username', type: 'text', access: memberAccess, admin: { width: '50%' } },
    ],
  },
  {
    name: 'application',
    type: 'relationship',
    relationTo: 'form-submissions',
    // One account per application: a second "Create accounts" for the same
    // person (a double click, two tabs) fails in the database.
    unique: true,
    index: true,
    access: memberAccess,
    admin: { position: 'sidebar', description: 'The membership application this account was created from.' },
  },
  {
    name: 'teamProfile',
    label: 'Team profile',
    type: 'relationship',
    relationTo: 'team',
    access: memberAccess,
    admin: { position: 'sidebar', description: 'The public profile on the Team page.' },
  },
  {
    name: 'accountExportedAt',
    label: 'Google account exported',
    type: 'date',
    access: memberAccess,
    admin: {
      position: 'sidebar',
      readOnly: true,
      date: { pickerAppearance: 'dayAndTime' },
      description: 'When the dashboard last put this account into a Google CSV, with a new password.',
    },
  },
  {
    name: 'signedInAt',
    label: 'First Google sign-in',
    type: 'date',
    access: memberAccess,
    admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
  },
];

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName', 'role', 'updatedAt'],
    // Editors may read their own account (the admin panel needs it), but the
    // list of accounts is the board's.
    hidden: ({ user }) => !hasAdminRole(user),
  },
  access: {
    // Members sign in for the onboarding page, never for the admin panel.
    admin: ({ req }) => hasEditorRole(req.user),
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
    unlock: isAdmin,
  },
  hooks: {
    beforeLogin: [onlyAdminsByPassword],
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: ROLES.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })),
      // Only an admin hands out rights; anyone else's value is ignored.
      access: { create: fieldIsAdmin, update: fieldIsAdmin },
      admin: {
        position: 'sidebar',
        description:
          'Member: the onboarding page only. Editor: website content, forms, TechTour page and analytics. Admin: everything.',
      },
    },
    ...memberFields,
  ],
};
