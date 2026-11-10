import { APIError, type CollectionBeforeLoginHook, type CollectionConfig } from 'payload';
import { fieldIsAdmin, hasAdminRole, hasEditorRole, isAdmin, isAdminOrSelf, ROLES } from '../access/roles';

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

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'updatedAt'],
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
  ],
};
