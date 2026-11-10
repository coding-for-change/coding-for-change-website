import type { Endpoint, PayloadRequest } from 'payload';
import { getPool, requireAdmin, requireEditor } from './util';

/**
 * Admin-only CSV export endpoints, mounted at the API root:
 *
 *   GET /api/analytics/campaigns.csv   funnel aggregate by source+channel
 *   GET /api/analytics/events.csv      raw behavioural events
 *   GET /api/analytics/signups.csv     waitlist signups + attribution
 *
 * All accept optional ?from=YYYY-MM-DD&to=YYYY-MM-DD (on created_at) and stream
 * CSV with a UTF-8 BOM so Excel reads umlauts correctly. For charts, see the
 * /admin/analytics dashboard (fed by analyticsSummary.ts); these exports are
 * the raw-data escape hatch for Excel/Sheets.
 */

const CSV_HEADERS = (filename: string): Record<string, string> => ({
  'Content-Type': 'text/csv; charset=utf-8',
  'Content-Disposition': `attachment; filename="${filename}"`,
  'Cache-Control': 'no-store',
});

function csvCell(v: unknown): string {
  if (v instanceof Date) v = v.toISOString();
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(columns: string[], rows: Array<Record<string, unknown>>): string {
  const header = columns.join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(r[c])).join(',')).join('\n');
  // Leading BOM => Excel detects UTF-8.
  return `﻿${header}\n${body}\n`;
}

/** Parse ?from / ?to into a created_at SQL clause + params (1-indexed $n). */
function dateRange(req: PayloadRequest): { clause: string; params: string[] } {
  let from: string | null = null;
  let to: string | null = null;
  try {
    const url = new URL(req.url ?? '', 'http://localhost');
    from = url.searchParams.get('from');
    to = url.searchParams.get('to');
  } catch {
    /* ignore malformed url */
  }
  const params: string[] = [];
  const conds: string[] = [];
  if (from) {
    params.push(from);
    conds.push(`created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conds.push(`created_at < ($${params.length}::date + interval '1 day')`);
  }
  return { clause: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params };
}

const campaignsCsv: Endpoint = {
  path: '/analytics/campaigns.csv',
  method: 'get',
  handler: async (req) => {
    const denied = requireEditor(req);
    if (denied) return denied;
    const pool = getPool(req);
    if (!pool) return new Response('DB pool unavailable', { status: 500 });

    const { clause, params } = dateRange(req);
    const { rows } = await pool.query(
      `SELECT
         COALESCE(NULLIF(attribution_source, ''), '(none)') AS source,
         COALESCE(attribution_channel::text, 'direct')      AS channel,
         COUNT(DISTINCT attribution_session_id)              AS sessions,
         COUNT(*) FILTER (WHERE type = 'landing')            AS landings,
         COUNT(*) FILTER (WHERE type = 'form_start')         AS form_starts,
         COUNT(*) FILTER (WHERE type = 'conversion')         AS conversions
       FROM analytics_events
       ${clause}
       GROUP BY 1, 2
       ORDER BY conversions DESC, sessions DESC`,
      params,
    );

    const withRate = rows.map((r) => {
      const sessions = Number(r.sessions) || 0;
      const conversions = Number(r.conversions) || 0;
      return {
        ...r,
        conv_rate_pct: sessions ? Math.round((conversions / sessions) * 1000) / 10 : 0,
      };
    });

    const csv = toCsv(
      ['source', 'channel', 'sessions', 'landings', 'form_starts', 'conversions', 'conv_rate_pct'],
      withRate,
    );
    return new Response(csv, { status: 200, headers: CSV_HEADERS('campaigns.csv') });
  },
};

const eventsCsv: Endpoint = {
  path: '/analytics/events.csv',
  method: 'get',
  handler: async (req) => {
    const denied = requireEditor(req);
    if (denied) return denied;
    const pool = getPool(req);
    if (!pool) return new Response('DB pool unavailable', { status: 500 });

    const { clause, params } = dateRange(req);
    const { rows } = await pool.query(
      `SELECT created_at, type, path, label, locale,
              attribution_source     AS source,
              attribution_channel    AS channel,
              attribution_medium     AS medium,
              attribution_campaign   AS campaign,
              attribution_referrer   AS referrer,
              attribution_session_id AS session_id
       FROM analytics_events
       ${clause}
       ORDER BY created_at DESC
       LIMIT 100000`,
      params,
    );
    const csv = toCsv(
      ['created_at', 'type', 'path', 'label', 'locale', 'source', 'channel', 'medium', 'campaign', 'referrer', 'session_id'],
      rows,
    );
    return new Response(csv, { status: 200, headers: CSV_HEADERS('events.csv') });
  },
};

const signupsCsv: Endpoint = {
  path: '/analytics/signups.csv',
  method: 'get',
  handler: async (req) => {
    // Addresses, not counts: the waitlist is admin-only, so is its export.
    const denied = requireAdmin(req);
    if (denied) return denied;
    const pool = getPool(req);
    if (!pool) return new Response('DB pool unavailable', { status: 500 });

    const { clause, params } = dateRange(req);
    const { rows } = await pool.query(
      `SELECT created_at, email, locale,
              attribution_source   AS source,
              attribution_channel  AS channel,
              attribution_medium   AS medium,
              attribution_campaign AS campaign,
              attribution_referrer AS referrer
       FROM waitlist_signups
       ${clause}
       ORDER BY created_at DESC
       LIMIT 100000`,
      params,
    );
    const csv = toCsv(
      ['created_at', 'email', 'locale', 'source', 'channel', 'medium', 'campaign', 'referrer'],
      rows,
    );
    return new Response(csv, { status: 200, headers: CSV_HEADERS('signups.csv') });
  },
};

export const analyticsExportEndpoints: Endpoint[] = [campaignsCsv, eventsCsv, signupsCsv];
