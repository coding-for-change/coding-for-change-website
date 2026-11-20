import { describe, expect, it } from 'vitest';
import { firstAccountRole, hasAdminRole, hasEditorRole, isAdmin, isAdminOrSelf, isEditor, requireRole, roleOf } from './roles';

const member = { id: 1, collection: 'users', role: 'member' };
const editor = { id: 2, collection: 'users', role: 'editor' };
const admin = { id: 3, collection: 'users', role: 'admin' };
// What the API-key strategy puts on req.user: the key itself, not a user.
const apiKey = { id: 9, collection: 'payload-mcp-api-keys', role: 'admin' };

const access = (fn: typeof isAdmin, user: unknown) =>
  fn({ req: { user } } as unknown as Parameters<typeof isAdmin>[0]);

describe('roleOf', () => {
  it('reads the role of a users account', () => {
    expect(roleOf(member)).toBe('member');
    expect(roleOf(editor)).toBe('editor');
    expect(roleOf(admin)).toBe('admin');
  });

  it('is null for anyone who is not a users account', () => {
    expect(roleOf(null)).toBeNull();
    expect(roleOf(undefined)).toBeNull();
    expect(roleOf(apiKey)).toBeNull();
    expect(roleOf({ role: 'admin' })).toBeNull();
  });

  it('treats a missing or unknown role as member', () => {
    expect(roleOf({ id: 4, collection: 'users' })).toBe('member');
    expect(roleOf({ id: 4, collection: 'users', role: 'owner' })).toBe('member');
  });
});

describe('role checks', () => {
  it('editor includes admin, admin is admin only', () => {
    expect([member, editor, admin].map(hasEditorRole)).toEqual([false, true, true]);
    expect([member, editor, admin].map(hasAdminRole)).toEqual([false, false, true]);
  });

  it('never trusts an API key on its own', () => {
    expect(hasAdminRole(apiKey)).toBe(false);
    expect(hasEditorRole(apiKey)).toBe(false);
    expect(access(isAdmin, apiKey)).toBe(false);
  });

  it('access functions follow the role', () => {
    expect(access(isEditor, editor)).toBe(true);
    expect(access(isEditor, member)).toBe(false);
    expect(access(isAdmin, editor)).toBe(false);
    expect(access(isAdmin, admin)).toBe(true);
    expect(access(isAdmin, null)).toBe(false);
  });

  it('isAdminOrSelf: all for admins, own account for others, nothing for anonymous', () => {
    expect(access(isAdminOrSelf, admin)).toBe(true);
    expect(access(isAdminOrSelf, member)).toEqual({ id: { equals: '1' } });
    expect(access(isAdminOrSelf, editor)).toEqual({ id: { equals: '2' } });
    expect(access(isAdminOrSelf, null)).toBe(false);
    expect(access(isAdminOrSelf, apiKey)).toBe(false);
  });
});

describe('requireRole', () => {
  it('401 without a login', () => {
    expect(requireRole({ user: null }, 'admin')?.status).toBe(401);
  });

  it('403 below the role, null at or above it', () => {
    const as = (user: unknown) => ({ user }) as Parameters<typeof requireRole>[0];
    expect(requireRole(as(member), 'editor')?.status).toBe(403);
    expect(requireRole(as(editor), 'editor')).toBeNull();
    expect(requireRole(as(editor), 'admin')?.status).toBe(403);
    expect(requireRole(as(admin), 'admin')).toBeNull();
    expect(requireRole(as(apiKey), 'editor')?.status).toBe(403);
  });
});

describe('firstAccountRole', () => {
  it('makes the first account of an empty table an admin, whatever was asked', () => {
    expect(firstAccountRole(0, undefined)).toBe('admin');
    expect(firstAccountRole(0, 'member')).toBe('admin');
  });

  it('never changes the role of a later account', () => {
    expect(firstAccountRole(1, 'member')).toBe('member');
    expect(firstAccountRole(1, undefined)).toBeUndefined();
    expect(firstAccountRole(5, 'editor')).toBe('editor');
  });
});
