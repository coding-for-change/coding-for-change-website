import type { Endpoint } from 'payload';
import { BASE_CTE, IN_CURRENT, SOURCE_EXPR, TIMEZONE, num, readDays } from './analyticsSummary';
import { getPool, requireAdmin } from './util';

/**
 * GET /api/analytics/flow?days=30
 *
 * Admin-only. How visitors move through the site, rebuilt from the events the
 * site already sends – no extra tracking. Every `landing` / `pageview` carries
 * the tab's random session id and a timestamp, so ordering a session's page
 * events by time gives that visit's path; window functions (LAG / LEAD) turn
 * it into "previous page" and "next page".
 *
 * Three answers, all aggregate counts:
 *  - `pages`    – for the 20 most-viewed pages: where visitors came from (the
 *                 previous page, or the outside source when the visit started
 *                 there) and where they went next (or that they left).
 *  - `journeys` – the most common page sequences per visit (first four steps).
 *  - `origins`  – per application type, whether the visit saw the Tech Tour
 *                 pages or the /join pages first before applying.
 *
 * A "visit" is one browser tab (see inner/src/lib/attribution.ts): a refresh,
 * a new tab or a later visit starts a new session and cannot be linked.
 * Deliberately no per-person view: the attribution data is "used only in
 * aggregate", so nothing here lists individual sessions or applicants.
 */

/**
 * Page path as used for flow: trailing slash dropped, and the per-item pages
 * (/projects/<slug>, /blog/<slug>) folded into one node each, so a journey
 * through three different projects doesn't fragment into three journeys.
 */
const PATH_EXPR = `regexp_replace(
  regexp_replace(COALESCE(NULLIF(path, ''), '(unknown)'), '(.)/+$', '\\1'),
  '^/(projects|blog)/[^/]+$', '/\\1/*'
)`;

/**
 * Shared CTEs on top of BASE_CTE. `pv` is one row per page event; `dedup`
 * drops consecutive repeats of the same path (defensive – the site only sends
 * a pageview on a path change); `steps` adds the neighbours within the visit.
 */
const STEPS_CTE = `${BASE_CTE},
  pv AS (
    SELECT sid, ts, ${PATH_EXPR} AS path, ${SOURCE_EXPR} AS src,
           COALESCE(channel, 'direct') AS ch
    FROM ev
    WHERE ${IN_CURRENT} AND type IN ('landing', 'pageview') AND sid IS NOT NULL
  ),
  dedup AS (
    SELECT sid, ts, path, src, ch,
           LAG(path) OVER (PARTITION BY sid ORDER BY ts) AS prev_raw
    FROM pv
  ),
  steps AS (
    SELECT sid, ts, path, src, ch,
           LAG(path)    OVER w AS prev,
           LEAD(path)   OVER w AS next,
           ROW_NUMBER() OVER w AS step
    FROM dedup
    WHERE prev_raw IS DISTINCT FROM path
    WINDOW w AS (PARTITION BY sid ORDER BY ts)
  )`;

const TOP_PAGES = 20;
/** Neighbours shown per side before the rest folds into "Other". */
const TOP_NEIGHBOURS = 7;
const JOURNEY_STEPS = 4;
const TOP_JOURNEYS = 10;

export type FlowEdge = {
  /** page = another page on the site; entry = the visit started here; exit = it ended here. */
  kind: 'page' | 'entry' | 'exit' | 'other';
  /** Page path, entry source (tag / referrer host / "(direct)"), or empty. */
  label: string;
  /** Entries only: the traffic channel, so "google" (tagged) and "google.com" (search) stay apart. */
  channel?: string;
  count: number;
};

export type FlowPage = {
  path: string;
  /** Page views, consecutive repeats removed. */
  views: number;
  /** Views that started a visit / ended it. */
  entries: number;
  exits: number;
  /** Visits that submitted a form on this page. */
  submissions: number;
  from: FlowEdge[];
  next: FlowEdge[];
};

export type Journey = {
  steps: string[];
  /** The visit went on past the steps shown. */
  more: boolean;
  sessions: number;
  converted: number;
};

export type OriginKind = 'membership' | 'speedrun' | 'techtour';

export type Origin = {
  kind: OriginKind;
  total: number;
  /** Saw only Tech Tour pages before applying. */
  ttOnly: number;
  /** Saw both; the Tech Tour first. */
  ttFirst: number;
  /** Saw both; /join first. */
  joinFirst: number;
  /** Saw only /join pages. */
  joinOnly: number;
  /**
   * Sent with the other program's form: a membership application ticked on the
   * Tech Tour registration, or a Tech Tour registration ticked on /join/apply.
   */
  viaOtherForm: number;
};

export type AnalyticsFlow = {
  range: { days: number };
  pages: FlowPage[];
  journeys: {
    sessions: number;
    singlePage: number;
    convertedSessions: number;
    all: Journey[];
    converted: Journey[];
  };
  origins: Origin[];
};

/** Rank edges, keep the top few, fold the rest into one "Other" row. */
function topEdges(edges: FlowEdge[]): FlowEdge[] {
  const sorted = [...edges].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (sorted.length <= TOP_NEIGHBOURS + 1) return sorted;
  const head = sorted.slice(0, TOP_NEIGHBOURS);
  const rest = sorted.slice(TOP_NEIGHBOURS).reduce((a, e) => a + e.count, 0);
  return [...head, { kind: 'other', label: '', count: rest }];
}

const ORIGIN_KINDS: OriginKind[] = ['membership', 'speedrun', 'techtour'];

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
    const params = [TIMEZONE, days];

    const [pagesRes, edgesRes, journeysRes, originsRes] = await Promise.all([
      // Per-page totals for the most-viewed pages, plus the visits that sent a
      // form from that page.
      pool.query(
        `${STEPS_CTE},
         subs AS (
           SELECT ${PATH_EXPR} AS path, COUNT(DISTINCT sid) AS n
           FROM ev
           WHERE ${IN_CURRENT} AND type = 'conversion' AND sid IS NOT NULL
           GROUP BY 1
         )
         SELECT s.path,
                COUNT(*)                                AS views,
                COUNT(*) FILTER (WHERE s.prev IS NULL) AS entries,
                COUNT(*) FILTER (WHERE s.next IS NULL) AS exits,
                COALESCE(MAX(subs.n), 0)               AS submissions
         FROM steps s LEFT JOIN subs USING (path)
         GROUP BY s.path
         ORDER BY views DESC, s.path
         LIMIT ${TOP_PAGES}`,
        params,
      ),
      // Every (page, neighbour) pair for those pages, both directions.
      pool.query(
        `${STEPS_CTE},
         top AS (
           SELECT path FROM steps GROUP BY path ORDER BY COUNT(*) DESC, path LIMIT ${TOP_PAGES}
         ),
         t AS (SELECT * FROM steps WHERE path IN (SELECT path FROM top))
         SELECT path, 'from' AS dir,
                CASE WHEN prev IS NULL THEN 'entry' ELSE 'page' END AS kind,
                COALESCE(prev, src) AS other,
                CASE WHEN prev IS NULL THEN ch END AS ch,
                COUNT(*) AS n
         FROM t GROUP BY 1, 2, 3, 4, 5
         UNION ALL
         SELECT path, 'next' AS dir,
                CASE WHEN next IS NULL THEN 'exit' ELSE 'page' END AS kind,
                COALESCE(next, '') AS other,
                NULL AS ch,
                COUNT(*) AS n
         FROM t GROUP BY 1, 2, 3, 4, 5`,
        params,
      ),
      // Journeys: each visit's first steps joined into one key (tab-separated;
      // paths never contain a tab), grouped. Returns the top multi-page
      // journeys, the top journeys of visits that converted, and the totals.
      pool.query(
        `${STEPS_CTE},
         conv AS (
           SELECT DISTINCT sid FROM ev
           WHERE ${IN_CURRENT} AND type = 'conversion' AND sid IS NOT NULL
         ),
         j AS (
           SELECT sid,
                  string_agg(path, chr(9) ORDER BY step) FILTER (WHERE step <= ${JOURNEY_STEPS}) AS head,
                  COUNT(*) AS len
           FROM steps GROUP BY sid
         ),
         g AS (
           SELECT head, len > ${JOURNEY_STEPS} AS more,
                  COUNT(*) AS sessions, COUNT(c.sid) AS converted
           FROM j LEFT JOIN conv c USING (sid)
           GROUP BY 1, 2
         )
         SELECT * FROM (
           SELECT 'all' AS list, head, more, sessions, converted FROM g
           WHERE strpos(head, chr(9)) > 0
           ORDER BY sessions DESC, converted DESC, head LIMIT ${TOP_JOURNEYS}
         ) a
         UNION ALL
         SELECT * FROM (
           SELECT 'converted', head, more, sessions, converted FROM g
           WHERE converted > 0
           ORDER BY converted DESC, sessions DESC, head LIMIT ${TOP_JOURNEYS}
         ) b
         UNION ALL
         SELECT 'total', NULL, NULL,
                COALESCE(SUM(sessions), 0),
                COALESCE(SUM(converted), 0)
         FROM g
         UNION ALL
         SELECT 'single', NULL, NULL, COALESCE(SUM(sessions), 0), 0
         FROM g WHERE strpos(head, chr(9)) = 0 AND NOT more`,
        params,
      ),
      // Application origin. For each application / Tech Tour registration
      // (the `conversion` event), look at the program pages that visit saw up
      // to the moment of sending: which program came first, and whether it
      // saw the other one at all. The conversion's own page counts, so every
      // row has at least one program page.
      pool.query(
        `${BASE_CTE},
         conv AS (
           SELECT sid, ts, label, path FROM ev
           WHERE ${IN_CURRENT} AND type = 'conversion'
             AND label IN ('application', 'techtour') AND sid IS NOT NULL
         ),
         prog AS (
           SELECT sid, ts,
                  CASE WHEN path = '/techtour' OR path LIKE '/techtour/%' THEN 'tt' ELSE 'join' END AS g
           FROM ev
           WHERE ${IN_CURRENT}
             AND type IN ('landing', 'pageview', 'conversion')
             AND (path = '/techtour' OR path LIKE '/techtour/%' OR path = '/join' OR path LIKE '/join/%')
             AND sid IN (SELECT sid FROM conv)
         ),
         o AS (
           SELECT c.label, c.path,
                  (SELECT p.g FROM prog p WHERE p.sid = c.sid AND p.ts <= c.ts ORDER BY p.ts LIMIT 1) AS first_g,
                  EXISTS (SELECT 1 FROM prog p WHERE p.sid = c.sid AND p.ts <= c.ts AND p.g = 'tt')   AS saw_tt,
                  EXISTS (SELECT 1 FROM prog p WHERE p.sid = c.sid AND p.ts <= c.ts AND p.g = 'join') AS saw_join
           FROM conv c
         )
         SELECT CASE WHEN label = 'techtour'             THEN 'techtour'
                     WHEN path LIKE '/join/speedrun%'    THEN 'speedrun'
                     ELSE 'membership' END                 AS kind,
                CASE WHEN path LIKE '/techtour%' THEN 'tt'
                     WHEN path LIKE '/join%'     THEN 'join'
                     ELSE 'other' END                      AS form_page,
                first_g, saw_tt, saw_join,
                COUNT(*) AS n
         FROM o
         GROUP BY 1, 2, 3, 4, 5`,
        params,
      ),
    ]);

    // ---- pages + their neighbours ----------------------------------------
    const edgesByPage = new Map<string, { from: FlowEdge[]; next: FlowEdge[] }>();
    for (const r of edgesRes.rows) {
      const path = String(r.path);
      const bucket = edgesByPage.get(path) ?? { from: [], next: [] };
      const edge: FlowEdge = {
        kind: r.kind as FlowEdge['kind'],
        label: r.kind === 'exit' ? '' : String(r.other ?? ''),
        count: num(r.n),
      };
      if (r.ch) edge.channel = String(r.ch);
      (r.dir === 'from' ? bucket.from : bucket.next).push(edge);
      edgesByPage.set(path, bucket);
    }
    const pages: FlowPage[] = pagesRes.rows.map((r) => {
      const path = String(r.path);
      const edges = edgesByPage.get(path) ?? { from: [], next: [] };
      return {
        path,
        views: num(r.views),
        entries: num(r.entries),
        exits: num(r.exits),
        submissions: num(r.submissions),
        from: topEdges(edges.from),
        next: topEdges(edges.next),
      };
    });

    // ---- journeys -----------------------------------------------------------
    const toJourney = (r: Record<string, unknown>): Journey => ({
      steps: String(r.head ?? '').split('\t'),
      more: Boolean(r.more),
      sessions: num(r.sessions),
      converted: num(r.converted),
    });
    const journeys: AnalyticsFlow['journeys'] = {
      sessions: 0,
      singlePage: 0,
      convertedSessions: 0,
      all: [],
      converted: [],
    };
    for (const r of journeysRes.rows) {
      if (r.list === 'all') journeys.all.push(toJourney(r));
      else if (r.list === 'converted') journeys.converted.push(toJourney(r));
      else if (r.list === 'total') {
        journeys.sessions = num(r.sessions);
        journeys.convertedSessions = num(r.converted);
      } else if (r.list === 'single') journeys.singlePage = num(r.sessions);
    }
    // UNION ALL keeps each subquery's rows together but not necessarily in
    // their ORDER BY; re-sort.
    journeys.all.sort((a, b) => b.sessions - a.sessions || b.converted - a.converted);
    journeys.converted.sort((a, b) => b.converted - a.converted || b.sessions - a.sessions);

    // ---- application origin ---------------------------------------------------
    const origins = new Map<OriginKind, Origin>(
      ORIGIN_KINDS.map((kind) => [
        kind,
        { kind, total: 0, ttOnly: 0, ttFirst: 0, joinFirst: 0, joinOnly: 0, viaOtherForm: 0 },
      ]),
    );
    for (const r of originsRes.rows) {
      const o = origins.get(r.kind as OriginKind);
      if (!o) continue;
      const n = num(r.n);
      // Sent from a page outside both programs – nothing to classify.
      if (!r.saw_tt && !r.saw_join) continue;
      o.total += n;
      if (r.saw_tt && r.saw_join) {
        if (r.first_g === 'tt') o.ttFirst += n;
        else o.joinFirst += n;
      } else if (r.saw_tt) o.ttOnly += n;
      else o.joinOnly += n;
      const ownPage = o.kind === 'techtour' ? 'tt' : 'join';
      if (r.form_page !== ownPage && r.form_page !== 'other') o.viaOtherForm += n;
    }

    const body: AnalyticsFlow = {
      range: { days },
      pages,
      journeys,
      // Speedrun only ran for a few weeks; leave it out of ranges without one.
      origins: [...origins.values()].filter((o) => o.kind !== 'speedrun' || o.total > 0),
    };
    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  },
};
