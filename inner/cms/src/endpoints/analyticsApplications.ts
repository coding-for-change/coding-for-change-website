import type { Endpoint } from 'payload';
import { CURRENT_STAGES_SQL } from '../lib/stages';
import { pathExpr } from './analyticsFlow';
import {
  BASE_CTE,
  IN_CURRENT,
  IN_EITHER,
  SOURCE_EXPR,
  TODAY_SQL,
  num,
  rangeParams,
  readRange,
} from './analyticsSummary';
import { getPool, requireAdmin } from './util';

/**
 * GET /api/analytics/applications?days=30 (or ?from=YYYY-MM-DD&to=YYYY-MM-DD)
 *
 * Admin-only aggregates for the "Applications" section of /admin/analytics:
 * membership applications, speedrun applications and Tech Tour registrations.
 *
 * Counts come from `form_submissions` (the forms titled "application" and
 * "techtour"; speedrun = source "speedrun"), so they match the review screens
 * and include visitors with Do-Not-Track, whose page views we don't record.
 * Source, channel and landing page come from each submission's own
 * attribution. Two answers need the visit's page views and therefore only
 * cover visits we have events for:
 *  - `origins` – did the visit see the Tech Tour pages or the /join pages
 *    first (joined on the session id, up to the moment of sending);
 *  - `funnel`  – form page seen → form started → sent, from the events; then,
 *    from the submissions themselves (all of them), how many the review
 *    accepted (= invited to interview), had their interview and were admitted
 *    (the stages set in the review workspace, lib/stages.ts) – Tech Tour: how
 *    many a host admitted to an evening.
 *
 * Only counts leave this endpoint – no names, answers or ids.
 */

export type AppKind = 'membership' | 'speedrun' | 'techtour';
export const APP_KINDS: AppKind[] = ['membership', 'speedrun', 'techtour'];

type PerKind = Record<AppKind, number>;

export type AppOrigin = {
  kind: AppKind;
  /** Visits with page data (the four buckets add up to this). */
  known: number;
  ttOnly: number;
  ttFirst: number;
  joinFirst: number;
  joinOnly: number;
  /** Submissions whose visit we have no page views for (Do-Not-Track, old data). */
  unknown: number;
  /**
   * Sent with the other program's form: a membership application ticked on
   * the Tech Tour registration, or a Tech Tour registration ticked on the
   * membership form.
   */
  viaOtherForm: number;
};

export type AnalyticsApplications = {
  range: { days: number; from: string | null; to: string | null };
  /** Series bucket: a day for ranges up to 31 days, a week (Monday) for longer ones. */
  bucket: 'day' | 'week';
  totals: Record<AppKind, { current: number; previous: number }>;
  series: Array<{ bucket: string } & PerKind>;
  sources: Array<{ source: string; channel: string; total: number } & PerKind>;
  landing: Array<{ path: string; total: number } & PerKind>;
  origins: AppOrigin[];
  funnel: Array<{
    kind: AppKind;
    /** Visits that saw the form page / focused a field / sent it there (events). */
    views: number;
    starts: number;
    sent: number;
    /** All submissions of this kind in the range (incl. tick-box and Do-Not-Track). */
    submissions: number;
    /** Review status "accepted" – for membership the interview invitation. */
    accepted: number;
    /** Tech Tour: admitted to at least one evening by its host. */
    hostAdmitted: number;
    /** Membership: stage "interview held", "admitted" or "not admitted". */
    interviewed: number;
    /** Membership: stage "admitted". */
    admitted: number;
  }>;
};

/** Submissions of the three kinds, with local time and unprefixed attribution. */
const SUBS_CTE = `
  WITH cfg AS (
    SELECT ${TODAY_SQL} AS today, $2::int AS days
  ),
  subs AS (
    SELECT s.id                                         AS id,
           CASE WHEN lower(trim(f.title)) = 'techtour' THEN 'techtour'
                WHEN s.source::text = 'speedrun'       THEN 'speedrun'
                ELSE 'membership' END                  AS kind,
           (s.created_at AT TIME ZONE $1)             AS ts,
           s.attribution_source                        AS source,
           s.attribution_channel::text                 AS channel,
           s.attribution_referrer                      AS referrer,
           s.attribution_landing_path                  AS landing,
           s.attribution_session_id                    AS sid,
           s.review_status::text                       AS review_status,
           s.host_decisions,
           cfg.today,
           cfg.days
    FROM form_submissions s
    JOIN forms f ON f.id = s.form_id
    CROSS JOIN cfg
    WHERE lower(trim(f.title)) IN ('application', 'techtour')
  )
`;

const PER_KIND = `
  COUNT(*) FILTER (WHERE kind = 'membership') AS membership,
  COUNT(*) FILTER (WHERE kind = 'speedrun')   AS speedrun,
  COUNT(*) FILTER (WHERE kind = 'techtour')   AS techtour,
  COUNT(*)                                    AS total`;

const perKind = (r: Record<string, unknown>): PerKind => ({
  membership: num(r.membership),
  speedrun: num(r.speedrun),
  techtour: num(r.techtour),
});

const IS_TT = `(path = '/techtour' OR path LIKE '/techtour/%')`;
const IS_JOIN = `(path = '/join' OR path LIKE '/join/%')`;

export const analyticsApplications: Endpoint = {
  path: '/analytics/applications',
  method: 'get',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const pool = getPool(req);
    if (!pool) return new Response('DB pool unavailable', { status: 500 });

    const range = readRange(req);
    if (range instanceof Response) return range;
    const { days } = range;
    const bucket: 'day' | 'week' = days <= 31 ? 'day' : 'week';
    const params = rangeParams(range);

    const [totalsRes, seriesRes, sourcesRes, landingRes, originsRes, funnelRes, reviewRes] = await Promise.all([
      pool.query(
        `${SUBS_CTE}
         SELECT kind, CASE WHEN ${IN_CURRENT} THEN 'current' ELSE 'previous' END AS period, COUNT(*) AS n
         FROM subs WHERE ${IN_EITHER}
         GROUP BY 1, 2`,
        params,
      ),
      // Zero-filled per day (or per week starting Monday).
      pool.query(
        `${SUBS_CTE},
         d AS (
           SELECT generate_series(
                    date_trunc($4::text, today - (days - 1) * interval '1 day'),
                    today,
                    ('1 ' || $4::text)::interval
                  ) AS bucket
           FROM cfg
         ),
         agg AS (
           SELECT date_trunc($4::text, ts) AS bucket, ${PER_KIND}
           FROM subs WHERE ${IN_CURRENT}
           GROUP BY 1
         )
         SELECT to_char(d.bucket, 'YYYY-MM-DD') AS bucket,
                COALESCE(a.membership, 0) AS membership,
                COALESCE(a.speedrun, 0)   AS speedrun,
                COALESCE(a.techtour, 0)   AS techtour
         FROM d LEFT JOIN agg a ON a.bucket = d.bucket
         ORDER BY d.bucket`,
        [...params, bucket],
      ),
      pool.query(
        `${SUBS_CTE}
         SELECT CASE WHEN sid IS NULL THEN '(not recorded)' ELSE ${SOURCE_EXPR} END AS source,
                CASE WHEN sid IS NULL THEN 'unknown' ELSE COALESCE(channel, 'direct') END AS channel,
                ${PER_KIND}
         FROM subs WHERE ${IN_CURRENT}
         GROUP BY 1, 2
         ORDER BY total DESC, source
         LIMIT 10`,
        params,
      ),
      pool.query(
        `${SUBS_CTE}
         SELECT CASE WHEN landing IS NULL OR landing = '' THEN '(not recorded)'
                     ELSE ${pathExpr('landing')} END AS path,
                ${PER_KIND}
         FROM subs WHERE ${IN_CURRENT}
         GROUP BY 1
         ORDER BY total DESC, path
         LIMIT 8`,
        params,
      ),
      // Per submission: the program pages its visit saw up to sending, and
      // whether it was sent with the other program's form (the conversion
      // event's page tells which form the tick-box was on).
      pool.query(
        `${SUBS_CTE},
         cur AS (SELECT * FROM subs WHERE ${IN_CURRENT}),
         prog AS (
           SELECT e.attribution_session_id AS sid,
                  (e.created_at AT TIME ZONE $1) AS ts,
                  CASE WHEN ${IS_TT.replace(/path/g, 'e.path')} THEN 'tt' ELSE 'join' END AS g
           FROM analytics_events e
           WHERE e.type IN ('landing', 'pageview', 'conversion')
             AND (${IS_TT.replace(/path/g, 'e.path')} OR ${IS_JOIN.replace(/path/g, 'e.path')})
             AND e.attribution_session_id IN (SELECT sid FROM cur WHERE sid IS NOT NULL)
         ),
         o AS (
           SELECT c.kind,
                  (SELECT p.g FROM prog p WHERE p.sid = c.sid AND p.ts <= c.ts ORDER BY p.ts LIMIT 1) AS first_g,
                  EXISTS (SELECT 1 FROM prog p WHERE p.sid = c.sid AND p.ts <= c.ts AND p.g = 'tt')   AS saw_tt,
                  EXISTS (SELECT 1 FROM prog p WHERE p.sid = c.sid AND p.ts <= c.ts AND p.g = 'join') AS saw_join,
                  EXISTS (
                    SELECT 1 FROM analytics_events e
                    WHERE e.attribution_session_id = c.sid AND e.type = 'conversion'
                      AND ((c.kind = 'techtour' AND e.label = 'techtour' AND ${IS_JOIN.replace(/path/g, 'e.path')})
                        OR (c.kind <> 'techtour' AND e.label = 'application' AND ${IS_TT.replace(/path/g, 'e.path')}))
                  ) AS via_other
           FROM cur c
         )
         SELECT kind, first_g, saw_tt, saw_join, via_other, COUNT(*) AS n
         FROM o GROUP BY 1, 2, 3, 4, 5`,
        params,
      ),
      // Form funnel from the events: visits that saw the form page, focused a
      // field, and sent it from that page.
      pool.query(
        `${BASE_CTE}
         SELECT k.kind,
                COUNT(DISTINCT ev.sid) FILTER (WHERE ev.type IN ('landing', 'pageview') AND ev.path = k.page) AS views,
                COUNT(DISTINCT ev.sid) FILTER (WHERE ev.type = 'form_start' AND ev.path = k.page)           AS starts,
                COUNT(DISTINCT ev.sid) FILTER (WHERE ev.type = 'conversion' AND ev.label = k.label AND ev.path = k.page) AS sent
         FROM ev
         CROSS JOIN (VALUES ('membership', '/join/apply',     'application'),
                            ('speedrun',   '/join/speedrun',  'application'),
                            ('techtour',   '/techtour/apply', 'techtour')) AS k(kind, page, label)
         WHERE ${IN_CURRENT} AND ev.sid IS NOT NULL
         GROUP BY k.kind`,
        params,
      ),
      // What happened to the submissions afterwards: the review verdict and,
      // for the Tech Tour, the hosts' decisions per evening.
      pool.query(
        `${SUBS_CTE},
         cur_stage AS (${CURRENT_STAGES_SQL})
         SELECT kind,
                COUNT(*) AS submissions,
                COUNT(*) FILTER (WHERE review_status = 'accepted') AS accepted,
                COUNT(*) FILTER (
                  WHERE jsonb_typeof(host_decisions) = 'object'
                    AND EXISTS (SELECT 1 FROM jsonb_each(host_decisions) d WHERE d.value->>'decision' = 'admitted')
                ) AS host_admitted,
                COUNT(*) FILTER (WHERE cs.stage IN ('interviewed', 'admitted', 'not_admitted')) AS interviewed,
                COUNT(*) FILTER (WHERE cs.stage = 'admitted') AS admitted
         FROM subs
         LEFT JOIN cur_stage cs ON cs.submission_id = subs.id
         WHERE ${IN_CURRENT}
         GROUP BY kind`,
        params,
      ),
    ]);

    const totals = Object.fromEntries(
      APP_KINDS.map((k) => [k, { current: 0, previous: 0 }]),
    ) as AnalyticsApplications['totals'];
    for (const r of totalsRes.rows) {
      const t = totals[r.kind as AppKind];
      if (t) t[r.period === 'current' ? 'current' : 'previous'] = num(r.n);
    }

    const origins = new Map<AppKind, AppOrigin>(
      APP_KINDS.map((kind) => [
        kind,
        { kind, known: 0, ttOnly: 0, ttFirst: 0, joinFirst: 0, joinOnly: 0, unknown: 0, viaOtherForm: 0 },
      ]),
    );
    for (const r of originsRes.rows) {
      const o = origins.get(r.kind as AppKind);
      if (!o) continue;
      const n = num(r.n);
      if (r.via_other) o.viaOtherForm += n;
      if (!r.saw_tt && !r.saw_join) {
        o.unknown += n;
        continue;
      }
      o.known += n;
      if (r.saw_tt && r.saw_join) {
        if (r.first_g === 'tt') o.ttFirst += n;
        else o.joinFirst += n;
      } else if (r.saw_tt) o.ttOnly += n;
      else o.joinOnly += n;
    }

    const funnelByKind = new Map(funnelRes.rows.map((r) => [String(r.kind), r]));
    const reviewByKind = new Map(reviewRes.rows.map((r) => [String(r.kind), r]));
    const series = seriesRes.rows.map((r) => ({ bucket: String(r.bucket), ...perKind(r) }));

    const body: AnalyticsApplications = {
      range: {
        days,
        from: series[0]?.bucket ?? null,
        to: series[series.length - 1]?.bucket ?? null,
      },
      bucket,
      totals,
      series,
      sources: sourcesRes.rows.map((r) => ({
        source: String(r.source),
        channel: String(r.channel),
        total: num(r.total),
        ...perKind(r),
      })),
      landing: landingRes.rows.map((r) => ({
        path: String(r.path),
        total: num(r.total),
        ...perKind(r),
      })),
      origins: [...origins.values()],
      funnel: APP_KINDS.map((kind) => {
        const r = funnelByKind.get(kind);
        const v = reviewByKind.get(kind);
        return {
          kind,
          views: num(r?.views),
          starts: num(r?.starts),
          sent: num(r?.sent),
          submissions: num(v?.submissions),
          accepted: num(v?.accepted),
          hostAdmitted: num(v?.host_admitted),
          interviewed: num(v?.interviewed),
          admitted: num(v?.admitted),
        };
      }),
    };
    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  },
};
