import type { Endpoint } from 'payload';
import { BASE_CTE, IN_CURRENT, SOURCE_EXPR, TIMEZONE, num, readDays } from './analyticsSummary';
import { getPool, requireAdmin } from './util';

/**
 * GET /api/analytics/flow?days=30
 *
 * Admin-only. How visitors move through the site, rebuilt from the events the
 * site already sends – no extra tracking. Every event carries the tab's random
 * session id and a timestamp, so ordering a session's events by time gives
 * that visit's path: the pages it saw and, in between, the conversions it made
 * (a form sent, a call booked) at the point they happened.
 *
 * The response is that path per visit, **grouped**: identical paths from the
 * same source collapse into one row with a count. The dashboard builds the flow
 * diagram and the journey list from these rows in the browser, so filtering by
 * source, start page or conversion type needs no new query.
 *
 * Steps are page paths (`/join`), or a conversion marker starting with `!`:
 * `!membership`, `!speedrun`, `!techtour`, `!contact`, `!waitlist`,
 * `!booking` (cal.com call booked), `!form:<label>` for any other form.
 *
 * Bounded so a 12-month range stays small: at most MAX_STEPS steps per visit,
 * pages outside the TOP_PAGES most viewed fold into "(other page)", sources
 * outside the TOP_SOURCES fold into "(other source)".
 *
 * A "visit" is one browser tab (see inner/src/lib/attribution.ts): a refresh,
 * a new tab or a later visit starts a new session and cannot be linked. Rows
 * are anonymous paths – no session id, no time, nothing about a person.
 */

/**
 * Page path as used for flow: trailing slash dropped, and the per-item pages
 * (/projects/<slug>, /blog/<slug>) folded into one node each, so a journey
 * through three different projects doesn't fragment into three journeys.
 */
export const pathExpr = (col: string) => `regexp_replace(
  regexp_replace(COALESCE(NULLIF(${col}, ''), '(unknown)'), '(.)/+$', '\\1'),
  '^/(projects|blog)/[^/]+$', '/\\1/*'
)`;
const PATH_EXPR = pathExpr('path');

/** Conversion marker for a conversion / booking event (see the doc above). */
const CONVERSION_STEP = `CASE
  WHEN type = 'booking_completed'                              THEN '!booking'
  WHEN label = 'application' AND path LIKE '/join/speedrun%'   THEN '!speedrun'
  WHEN label = 'application'                                   THEN '!membership'
  WHEN label IN ('techtour', 'contact', 'waitlist')            THEN '!' || label
  ELSE '!form:' || COALESCE(NULLIF(label, ''), 'unknown')
END`;

const MAX_STEPS = 8;
const TOP_PAGES = 40;
const TOP_SOURCES = 20;

export type PathGroup = {
  /** Where the visit came from: campaign tag, referrer host or "(direct)". */
  src: string;
  /** Traffic channel of that source (campaign, organic_search, social, referral, direct). */
  ch: string;
  /** Pages and conversion markers in order (see the module doc). */
  steps: string[];
  /** The visit went on past MAX_STEPS. */
  more: boolean;
  /** Visits that took exactly this path. */
  n: number;
};

export type AnalyticsFlow = {
  range: { days: number };
  maxSteps: number;
  sessions: number;
  paths: PathGroup[];
};

export const analyticsFlow: Endpoint = {
  path: '/analytics/flow',
  method: 'get',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const pool = getPool(req);
    if (!pool) return new Response('DB pool unavailable', { status: 500 });

    const days = readDays(req);
    if (days instanceof Response) return days;

    const { rows } = await pool.query(
      `${BASE_CTE},
       st AS (
         SELECT sid, ts,
                CASE WHEN type IN ('landing', 'pageview') THEN ${PATH_EXPR} ELSE ${CONVERSION_STEP} END AS step,
                -- pages before conversions when two events share a timestamp
                CASE WHEN type IN ('landing', 'pageview') THEN 0 ELSE 1 END AS ord,
                ${SOURCE_EXPR} AS src,
                COALESCE(channel, 'direct') AS ch
         FROM ev
         WHERE ${IN_CURRENT} AND sid IS NOT NULL
           AND type IN ('landing', 'pageview', 'conversion', 'booking_completed')
       ),
       top_pages AS (
         SELECT step FROM st WHERE ord = 0
         GROUP BY step ORDER BY COUNT(*) DESC, step LIMIT ${TOP_PAGES}
       ),
       top_sources AS (
         SELECT src FROM st
         GROUP BY src ORDER BY COUNT(DISTINCT sid) DESC, src LIMIT ${TOP_SOURCES}
       ),
       folded AS (
         SELECT sid, ts, ord, ch,
                CASE WHEN ord = 1 OR step IN (SELECT step FROM top_pages) THEN step
                     ELSE '(other page)' END AS step,
                CASE WHEN src IN (SELECT src FROM top_sources) THEN src
                     ELSE '(other source)' END AS src
         FROM st
       ),
       -- Drop consecutive repeats (a double-fired booking event, two folded
       -- pages in a row) so every step is a real move.
       dedup AS (
         SELECT *, LAG(step) OVER (PARTITION BY sid ORDER BY ts, ord) AS prev
         FROM folded
       ),
       seq AS (
         SELECT sid, step, src, ch,
                ROW_NUMBER() OVER (PARTITION BY sid ORDER BY ts, ord) AS i
         FROM dedup
         WHERE prev IS DISTINCT FROM step
       ),
       per_visit AS (
         SELECT sid,
                MIN(src) AS src,
                MIN(ch)  AS ch,
                string_agg(step, chr(9) ORDER BY i) FILTER (WHERE i <= ${MAX_STEPS}) AS steps,
                COUNT(*) > ${MAX_STEPS} AS more
         FROM seq
         GROUP BY sid
       )
       SELECT src, ch, steps, more, COUNT(*) AS n
       FROM per_visit
       WHERE steps IS NOT NULL
       GROUP BY 1, 2, 3, 4
       ORDER BY n DESC`,
      [TIMEZONE, days],
    );

    const paths: PathGroup[] = rows.map((r) => ({
      src: String(r.src),
      ch: String(r.ch),
      steps: String(r.steps).split('\t'),
      more: Boolean(r.more),
      n: num(r.n),
    }));
    const body: AnalyticsFlow = {
      range: { days },
      maxSteps: MAX_STEPS,
      sessions: paths.reduce((a, p) => a + p.n, 0),
      paths,
    };
    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  },
};
