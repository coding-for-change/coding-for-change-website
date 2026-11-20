import type { Payload, PayloadRequest } from 'payload';
import { requireRole } from '../access/roles';

/**
 * 401 without a login, 403 unless it is a `users` account with role admin;
 * null when allowed. The MCP admin tools pass the key's user, so a key works
 * here exactly when its user is an admin (access/roles.ts).
 */
export function requireAdmin(req: PayloadRequest): Response | null {
  return requireRole(req, 'admin');
}

/** The same for editors and admins: the analytics endpoints. */
export function requireEditor(req: PayloadRequest): Response | null {
  return requireRole(req, 'editor');
}

export type PgPool = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

// The postgres adapter exposes a node-postgres Pool for raw aggregate queries.
export function getPool(req: PayloadRequest): PgPool | null {
  const pool = (req.payload.db as unknown as { pool?: unknown }).pool;
  return pool && typeof (pool as { query?: unknown }).query === 'function'
    ? (pool as PgPool)
    : null;
}

/** The same pool without a request (local API, hooks, jobs); throws when there is none. */
export function poolOf(payload: Payload): PgPool {
  const pool = (payload.db as unknown as { pool?: PgPool }).pool;
  if (!pool || typeof pool.query !== 'function') throw new Error('no database pool');
  return pool;
}
