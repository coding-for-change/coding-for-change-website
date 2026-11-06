import type { Endpoint } from 'payload';
import { getPool, requireAdmin } from './util';

/**
 * GET /api/analytics/summary?days=30
 *
 * Admin-only JSON aggregates over `analytics_events` (+ `waitlist_signups`)
 * feeding the /admin/analytics dashboard: KPI totals for the selected window
 * and the window before it (for deltas), a zero-filled time series, the
 * behavioural funnel, and channel / source / page / CTA / outbound / locale
 * breakdowns. Same raw-SQL-over-the-adapter-pool approach as the CSV exports.
 *
 * `days` must be one of 7 | 30 | 90 | 365 (default 30) – or pass a custom
 * `from=YYYY-MM-DD&to=YYYY-MM-DD` (both inclusive, at most 731 days); the
 * "previous" period is then the same number of days just before `from`.
 * Bucketing and the window boundaries use ANALYTICS_TZ (default Europe/Berlin)
 * so "a day" means a local calendar day, not a UTC one. Windows of up to 7
 * days are bucketed into 6-hour slices so the chart isn't a few stretched
 * segments; longer windows stay daily.
 */

export const ALLOWED_DAYS = new Set([7, 30, 90, 365]);
export const TIMEZONE = process.env.ANALYTICS_TZ || 'Europe/Berlin';

/**
 * The window's last day (local midnight): the custom end date ($3) when one
 * was given, otherwise today.
 */
export const TODAY_SQL = `COALESCE($3::date::timestamp, date_trunc('day', now() AT TIME ZONE $1))`;

/**
 * Shared CTE prefix. `cfg` pins the window's last day and its length; `ev`
 * projects events with local timestamps and unprefixed attribution columns.
 * Every query takes params [$1 timezone, $2 days, $3 end date or null]
 * (see `rangeParams`); a query-specific extra goes in $4.
 */
export const BASE_CTE = `
  WITH cfg AS (
    SELECT ${TODAY_SQL} AS today, $2::int AS days
  ),
  ev AS (
    SELECT e.type::text AS type,
           e.path,
           e.label,
           e.locale,
           e.attribution_source          AS source,
           e.attribution_channel::text   AS channel,
           e.attribution_campaign        AS campaign,
           e.attribution_referrer        AS referrer,
           e.attribution_session_id      AS sid,
           (e.created_at AT TIME ZONE $1) AS ts,
           cfg.today,
           cfg.days
    FROM analytics_events e, cfg
  )
`;

// Window predicates over the projected local timestamp.
export const IN_CURRENT = `ts >= today - (days - 1) * interval '1 day' AND ts < today + interval '1 day'`;
export const IN_EITHER = `ts >= today - (2 * days - 1) * interval '1 day' AND ts < today + interval '1 day'`;

/**
 * What to show as "the source": the explicit campaign tag (?src= / utm_source)
 * when there is one, otherwise the referrer host — so untagged social/search
 * traffic reads "linkedin.com" instead of "(none)". Referrer hosts are
 * lowercased and common mobile/link-shim prefixes (www. m. l. lm. out.) are
 * stripped so l.instagram.com and instagram.com count as one source. Traffic
 * with neither tag nor referrer is "(direct)".
 */
export const SOURCE_EXPR = `COALESCE(
  NULLIF(source, ''),
  NULLIF(regexp_replace(lower(referrer), '^(www|m|l|lm|out)\\.', ''), ''),
  '(direct)'
)`;

export const num = (v: unknown): number => Number(v) || 0;

type PeriodTotals = {
  sessions: number;
  pageviews: number;
  landings: number;
  ctaClicks: number;
  formStarts: number;
  conversions: number;
  outboundClicks: number;
  bookingsStarted: number;
};

const emptyTotals = (): PeriodTotals => ({
  sessions: 0,
  pageviews: 0,
  landings: 0,
  ctaClicks: 0,
  formStarts: 0,
  conversions: 0,
  outboundClicks: 0,
  bookingsStarted: 0,
});

export type Range = {
  /** Window length in days (both ends inclusive). */
  days: number;
  /** Custom last day (YYYY-MM-DD), or null for "up to today". */
  end: string | null;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CUSTOM_DAYS = 731;

/**
 * The window from the query: `?from=YYYY-MM-DD&to=YYYY-MM-DD` (custom,
 * inclusive) or `?days=7|30|90|365` (default 30, ending today). A 400
 * response when it isn't valid.
 */
export function readRange(req: { url?: string }): Range | Response {
  const bad = (error: string) => Response.json({ error }, { status: 400 });
  let url: URL;
  try {
    url = new URL(req.url ?? '', 'http://localhost');
  } catch {
    return { days: 30, end: null };
  }
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (from !== null || to !== null) {
    if (!from || !to || !ISO_DAY.test(from) || !ISO_DAY.test(to)) {
      return bad('from and to must both be YYYY-MM-DD');
    }
    const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
    if (!Number.isFinite(days) || days < 1 || days > MAX_CUSTOM_DAYS) {
      return bad(`the range must be 1 to ${MAX_CUSTOM_DAYS} days, from before to`);
    }
    return { days, end: to };
  }
  const raw = url.searchParams.get('days');
  const days = raw === null ? 30 : Number(raw);
  if (!ALLOWED_DAYS.has(days)) return bad('days must be one of 7, 30, 90, 365');
  return { days, end: null };
}

/** The [$1, $2, $3] every query built on BASE_CTE / TODAY_SQL takes. */
export const rangeParams = (r: Range) => [TIMEZONE, r.days, r.end];

const convRatePct = (conversions: number, sessions: number): number =>
  sessions ? Math.round((conversions / sessions) * 1000) / 10 : 0;

export const analyticsSummary: Endpoint = {
  path: '/analytics/summary',
  method: 'get',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const pool = getPool(req);
    if (!pool) return new Response('DB pool unavailable', { status: 500 });

    const range = readRange(req);
    if (range instanceof Response) return range;
    const { days } = range;

    // Short window → intraday buckets, otherwise calendar days. 7 × 4 = 28
    // points instead of 7, so the short-range chart isn't stretched thin.
    const bucketHours = days <= 7 ? 6 : 24;
    const params = rangeParams(range);

    const [totalsRes, seriesRes, funnelRes, channelsRes, sourcesRes, shareRes, pagesRes, ctasRes, outboundRes, localesRes, signupsRes] =
      await Promise.all([
        // KPI totals, current + previous window in one pass.
        pool.query(
          `${BASE_CTE}
           SELECT CASE WHEN ${IN_CURRENT} THEN 'current' ELSE 'previous' END AS period,
                  COUNT(DISTINCT sid)                                    AS sessions,
                  COUNT(*) FILTER (WHERE type IN ('landing','pageview')) AS pageviews,
                  COUNT(*) FILTER (WHERE type = 'landing')               AS landings,
                  COUNT(*) FILTER (WHERE type = 'cta_click')             AS cta_clicks,
                  COUNT(*) FILTER (WHERE type = 'form_start')            AS form_starts,
                  COUNT(*) FILTER (WHERE type = 'conversion')            AS conversions,
                  COUNT(*) FILTER (WHERE type = 'outbound_click')        AS outbound_clicks,
                  COUNT(*) FILTER (WHERE type = 'booking_started')       AS bookings_started
           FROM ev
           WHERE ${IN_EITHER}
           GROUP BY 1`,
          params,
        ),
        // Zero-filled time series for the current window. Buckets are aligned
        // to local midnight ($4 = hours per bucket: 24, or 6 for short
        // windows), so a "bucket" is a calendar day or a quarter of one.
        pool.query(
          `${BASE_CTE},
           d AS (
             SELECT generate_series(
                      today - (days - 1) * interval '1 day',
                      today + interval '1 day' - make_interval(hours => $4::int),
                      make_interval(hours => $4::int)
                    ) AS bucket
             FROM cfg
           ),
           agg AS (
             SELECT date_trunc('day', ts)
                      + make_interval(hours => (floor(extract(hour FROM ts) / $4::int) * $4)::int) AS bucket,
                    COUNT(DISTINCT sid)                                    AS sessions,
                    COUNT(*) FILTER (WHERE type IN ('landing','pageview')) AS pageviews,
                    COUNT(*) FILTER (WHERE type = 'conversion')            AS conversions
             FROM ev
             WHERE ${IN_CURRENT}
             GROUP BY 1
           )
           SELECT to_char(d.bucket, 'YYYY-MM-DD"T"HH24:MI') AS bucket,
                  COALESCE(a.sessions, 0)    AS sessions,
                  COALESCE(a.pageviews, 0)   AS pageviews,
                  COALESCE(a.conversions, 0) AS conversions
           FROM d LEFT JOIN agg a ON a.bucket = d.bucket
           ORDER BY d.bucket`,
          [...params, bucketHours],
        ),
        // Funnel: distinct sessions that reached each behavioural stage.
        pool.query(
          `${BASE_CTE}
           SELECT type, COUNT(DISTINCT sid) AS sessions
           FROM ev
           WHERE ${IN_CURRENT} AND type IN ('cta_click','form_start','conversion')
           GROUP BY type`,
          params,
        ),
        pool.query(
          `${BASE_CTE}
           SELECT COALESCE(channel, 'direct') AS channel,
                  COUNT(DISTINCT sid)                         AS sessions,
                  COUNT(*) FILTER (WHERE type = 'conversion') AS conversions
           FROM ev
           WHERE ${IN_CURRENT}
           GROUP BY 1
           ORDER BY sessions DESC`,
          params,
        ),
        pool.query(
          `${BASE_CTE}
           SELECT ${SOURCE_EXPR}                          AS source,
                  COALESCE(channel, 'direct')             AS channel,
                  NULLIF(campaign, '')                    AS campaign,
                  COUNT(DISTINCT sid)                          AS sessions,
                  COUNT(*) FILTER (WHERE type = 'form_start')  AS form_starts,
                  COUNT(*) FILTER (WHERE type = 'conversion')  AS conversions
           FROM ev
           WHERE ${IN_CURRENT}
           GROUP BY 1, 2, 3
           ORDER BY conversions DESC, sessions DESC, source
           LIMIT 12`,
          params,
        ),
        // Session share of the top sources, for the donut next to the chart.
        // Channel comes along so the legend can tell "google" (tagged ads)
        // from "google.com" (organic); the mapping is 1:1 by derivation.
        pool.query(
          `${BASE_CTE}
           SELECT ${SOURCE_EXPR}              AS source,
                  COALESCE(channel, 'direct') AS channel,
                  COUNT(DISTINCT sid)         AS sessions
           FROM ev
           WHERE ${IN_CURRENT}
           GROUP BY 1, 2
           HAVING COUNT(DISTINCT sid) > 0
           ORDER BY sessions DESC, source
           LIMIT 4`,
          params,
        ),
        pool.query(
          `${BASE_CTE}
           SELECT COALESCE(NULLIF(path, ''), '(unknown)') AS path,
                  COUNT(*)            AS views,
                  COUNT(DISTINCT sid) AS sessions
           FROM ev
           WHERE ${IN_CURRENT} AND type IN ('landing','pageview')
           GROUP BY 1
           ORDER BY views DESC
           LIMIT 10`,
          params,
        ),
        // CTA clicks per button *and* the page it was clicked on, so one
        // label (e.g. nav-join) can be compared across pages.
        pool.query(
          `${BASE_CTE}
           SELECT COALESCE(NULLIF(label, ''), '(unlabelled)') AS label,
                  COALESCE(NULLIF(path, ''), '(unknown)')    AS path,
                  COUNT(*) AS clicks
           FROM ev
           WHERE ${IN_CURRENT} AND type = 'cta_click'
           GROUP BY 1, 2
           ORDER BY clicks DESC, label
           LIMIT 10`,
          params,
        ),
        pool.query(
          `${BASE_CTE}
           SELECT COALESCE(NULLIF(label, ''), '(unknown)') AS label, COUNT(*) AS clicks
           FROM ev
           WHERE ${IN_CURRENT} AND type = 'outbound_click'
           GROUP BY 1
           ORDER BY clicks DESC
           LIMIT 10`,
          params,
        ),
        pool.query(
          `${BASE_CTE}
           SELECT COALESCE(NULLIF(locale, ''), '(unknown)') AS locale, COUNT(DISTINCT sid) AS sessions
           FROM ev
           WHERE ${IN_CURRENT}
           GROUP BY 1
           ORDER BY sessions DESC`,
          params,
        ),
        // Waitlist signups are the ground-truth conversion record.
        pool.query(
          `WITH cfg AS (
             SELECT ${TODAY_SQL} AS today, $2::int AS days
           )
           SELECT CASE WHEN (w.created_at AT TIME ZONE $1) >= today - (days - 1) * interval '1 day'
                       THEN 'current' ELSE 'previous' END AS period,
                  COUNT(*) AS signups
           FROM waitlist_signups w, cfg
           WHERE (w.created_at AT TIME ZONE $1) >= today - (2 * days - 1) * interval '1 day'
             AND (w.created_at AT TIME ZONE $1) < today + interval '1 day'
           GROUP BY 1`,
          params,
        ),
      ]);

    const totalsByPeriod: Record<'current' | 'previous', PeriodTotals> = {
      current: emptyTotals(),
      previous: emptyTotals(),
    };
    for (const r of totalsRes.rows) {
      const period = r.period === 'current' ? 'current' : 'previous';
      totalsByPeriod[period] = {
        sessions: num(r.sessions),
        pageviews: num(r.pageviews),
        landings: num(r.landings),
        ctaClicks: num(r.cta_clicks),
        formStarts: num(r.form_starts),
        conversions: num(r.conversions),
        outboundClicks: num(r.outbound_clicks),
        bookingsStarted: num(r.bookings_started),
      };
    }

    const signups = { current: 0, previous: 0 };
    for (const r of signupsRes.rows) {
      if (r.period === 'current') signups.current = num(r.signups);
      else signups.previous = num(r.signups);
    }

    const series = seriesRes.rows.map((r) => ({
      bucket: String(r.bucket), // YYYY-MM-DDTHH:MM, local to TIMEZONE
      sessions: num(r.sessions),
      pageviews: num(r.pageviews),
      conversions: num(r.conversions),
    }));

    const stageSessions: Record<string, number> = {};
    for (const r of funnelRes.rows) stageSessions[String(r.type)] = num(r.sessions);
    const cur = totalsByPeriod.current;
    // Ordered stages; the top of the funnel is every session in the window.
    const funnel = [
      { stage: 'visited', sessions: cur.sessions },
      { stage: 'cta_click', sessions: stageSessions.cta_click ?? 0 },
      { stage: 'form_start', sessions: stageSessions.form_start ?? 0 },
      { stage: 'conversion', sessions: stageSessions.conversion ?? 0 },
    ].map((s) => ({
      ...s,
      pctOfSessions: cur.sessions
        ? Math.round((s.sessions / cur.sessions) * 1000) / 10
        : 0,
    }));

    const body = {
      generatedAt: new Date().toISOString(),
      timezone: TIMEZONE,
      range: {
        days,
        from: series[0]?.bucket.slice(0, 10) ?? null,
        to: series[series.length - 1]?.bucket.slice(0, 10) ?? null,
      },
      totals: {
        ...cur,
        signups: signups.current,
        convRatePct: convRatePct(cur.conversions, cur.sessions),
      },
      previous: {
        ...totalsByPeriod.previous,
        signups: signups.previous,
        convRatePct: convRatePct(
          totalsByPeriod.previous.conversions,
          totalsByPeriod.previous.sessions,
        ),
      },
      bucketHours,
      series,
      funnel,
      channels: channelsRes.rows.map((r) => ({
        channel: String(r.channel),
        sessions: num(r.sessions),
        conversions: num(r.conversions),
      })),
      sources: sourcesRes.rows.map((r) => {
        const sessions = num(r.sessions);
        const conversions = num(r.conversions);
        return {
          source: String(r.source),
          channel: String(r.channel),
          campaign: r.campaign == null ? null : String(r.campaign),
          sessions,
          formStarts: num(r.form_starts),
          conversions,
          convRatePct: convRatePct(conversions, sessions),
        };
      }),
      sourceShare: shareRes.rows.map((r) => ({
        source: String(r.source),
        channel: String(r.channel),
        sessions: num(r.sessions),
      })),
      pages: pagesRes.rows.map((r) => ({
        path: String(r.path),
        views: num(r.views),
        sessions: num(r.sessions),
      })),
      ctas: ctasRes.rows.map((r) => ({
        label: String(r.label),
        path: String(r.path),
        clicks: num(r.clicks),
      })),
      outbound: outboundRes.rows.map((r) => ({
        label: String(r.label),
        clicks: num(r.clicks),
      })),
      locales: localesRes.rows.map((r) => ({
        locale: String(r.locale),
        sessions: num(r.sessions),
      })),
    };

    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  },
};

export type AnalyticsSummary = {
  generatedAt: string;
  timezone: string;
  range: { days: number; from: string | null; to: string | null };
  totals: PeriodTotals & { signups: number; convRatePct: number };
  previous: PeriodTotals & { signups: number; convRatePct: number };
  /** Hours per series bucket: 6 for the 7-day range, otherwise 24. */
  bucketHours: number;
  series: Array<{ bucket: string; sessions: number; pageviews: number; conversions: number }>;
  funnel: Array<{ stage: string; sessions: number; pctOfSessions: number }>;
  channels: Array<{ channel: string; sessions: number; conversions: number }>;
  sources: Array<{
    source: string;
    channel: string;
    campaign: string | null;
    sessions: number;
    formStarts: number;
    conversions: number;
    convRatePct: number;
  }>;
  sourceShare: Array<{ source: string; channel: string; sessions: number }>;
  pages: Array<{ path: string; views: number; sessions: number }>;
  ctas: Array<{ label: string; path: string; clicks: number }>;
  outbound: Array<{ label: string; clicks: number }>;
  locales: Array<{ locale: string; sessions: number }>;
};
