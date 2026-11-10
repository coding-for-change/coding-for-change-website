import type { Access, FieldAccess, PayloadRequest } from 'payload';

/**
 * Who may do what in the CMS. Three roles on `users.role`:
 *
 * - `member`: signs in with Google for the onboarding page only. Never gets
 *   into the admin panel and sees nothing there the public cannot see.
 * - `editor`: website content, the form definitions (not what people sent
 *   in), the TechTour page and the analytics.
 * - `admin`: everything, including applications, mailing, users and the MCP
 *   API keys. The board.
 *
 * Only a logged-in `users` account carries a role. An MCP API key that
 * authenticates on its own (`payload-mcp-api-keys`) is no one here: the MCP
 * endpoint runs every tool as the key's user instead, so a key can do what
 * its user can, never more. The helpers take `unknown` for that reason: they
 * are the one place that decides what a request's user is.
 */

export const ROLES = ['member', 'editor', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** The role of a `users` account, or null for anyone else (anonymous, API key). */
export function roleOf(user: unknown): Role | null {
  if (!user || typeof user !== 'object') return null;
  const { collection, role } = user as { collection?: unknown; role?: unknown };
  if (collection !== 'users') return null;
  // A row from before the role column, or one the migration has not reached
  // yet, counts as the least: nobody gets rights by accident.
  return (ROLES as readonly unknown[]).includes(role) ? (role as Role) : 'member';
}

export const hasAdminRole = (user: unknown): boolean => roleOf(user) === 'admin';

/** Editor or admin. */
export const hasEditorRole = (user: unknown): boolean => {
  const role = roleOf(user);
  return role === 'editor' || role === 'admin';
};

const userId = (user: unknown): string | null => {
  const id = user && typeof user === 'object' ? (user as { id?: unknown }).id : null;
  return typeof id === 'number' || (typeof id === 'string' && id) ? String(id) : null;
};

// ---- Payload access functions ----------------------------------------------

export const anyone: Access = () => true;
export const nobody: Access = () => false;

export const isAdmin: Access = ({ req }) => hasAdminRole(req.user);
export const isEditor: Access = ({ req }) => hasEditorRole(req.user);

/** Admins see every account, everyone else only their own. */
export const isAdminOrSelf: Access = ({ req }) => {
  if (hasAdminRole(req.user)) return true;
  const id = roleOf(req.user) ? userId(req.user) : null;
  return id ? { id: { equals: id } } : false;
};

export const fieldIsAdmin: FieldAccess = ({ req }) => hasAdminRole(req.user);
export const fieldIsEditor: FieldAccess = ({ req }) => hasEditorRole(req.user);

/** Website content: everyone reads it, editors write it. */
export const contentAccess = {
  read: anyone,
  create: isEditor,
  update: isEditor,
  delete: isEditor,
};

/** A website page (global): everyone reads it, editors write it. */
export const pageAccess = {
  read: anyone,
  update: isEditor,
};

/**
 * What the public site sends in anonymously (form submissions, CVs, waitlist,
 * consent records): anyone may add, only admins may see or change.
 */
export const publicInboxAccess = {
  create: anyone,
  read: isAdmin,
  update: isAdmin,
  delete: isAdmin,
};

/** Admin only, both ways. */
export const adminOnlyAccess = {
  read: isAdmin,
  create: isAdmin,
  update: isAdmin,
  delete: isAdmin,
};

// ---- custom endpoints ------------------------------------------------------

/** 401 without a login, 403 for a login below `role`; null when allowed. */
export function requireRole(req: Pick<PayloadRequest, 'user'>, role: 'editor' | 'admin'): Response | null {
  if (!req.user) return new Response('Unauthorized', { status: 401 });
  const allowed = role === 'admin' ? hasAdminRole(req.user) : hasEditorRole(req.user);
  return allowed ? null : new Response('Forbidden', { status: 403 });
}
