import type { Payload, PayloadRequest } from 'payload';

/** 401 unless a logged-in admin user is on the request; null when allowed. */
export function requireAdmin(req: PayloadRequest): Response | null {
  if (!req.user) return new Response('Unauthorized', { status: 401 });
  return null;
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
