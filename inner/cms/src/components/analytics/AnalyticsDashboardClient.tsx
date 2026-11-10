'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnalyticsApplications } from '../../endpoints/analyticsApplications';
import type { AnalyticsFlow } from '../../endpoints/analyticsFlow';
import type { AnalyticsSummary } from '../../endpoints/analyticsSummary';
import { ApplicationsSection } from './ApplicationsSection';
import { PathsCard } from './PathExplorer';
import { BarList, Card, Delta, StatTile, fmtBucketRow, fmtCompact, fmtInt } from './parts';
import { SourceDonut } from './SourceDonut';
import { TimeSeriesChart } from './TimeSeriesChart';

/**
 * The /admin/analytics dashboard body: range filter, KPI tiles, the traffic
 * time-series with a session-share donut beside it, funnel, and
 * channel/source/page/CTA breakdowns, all fed by one
 * GET /api/analytics/summary call so every panel shows the same slice. The
 * visitor-paths card (explorer + common paths) comes from GET /api/analytics/flow
 * for the same range, fetched alongside so a failure there doesn't blank the
 * rest. The "Applications" tab has its own endpoint, fetched when opened
 * (?tab=applications links straight to it). Rendered inside the Payload admin
 * (DefaultTemplate) by AnalyticsDashboardView.
 */

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '12 months' },
];

/** Local calendar day as YYYY-MM-DD (date inputs speak this format). */
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const CHANNEL_LABELS: Record<string, string> = {
  campaign: 'Campaign (tagged)',
  organic_search: 'Organic search',
  social: 'Social',
  referral: 'Referral',
  direct: 'Direct',
};

/** Readable names for the site's `data-cta` labels (inner/src, grep "data-cta"). */
const CTA_LABELS: Record<string, string> = {
  'apply-bar': 'Apply bar (banner at the top)',
  'nav-join': 'Navigation: Join / Apply button',
  'nav-techtour': 'Navigation: Tech Tour',
  'techtour-apply-hero': 'Tech Tour page: Apply (top)',
  'techtour-apply-stop': 'Tech Tour page: Apply (at a stop)',
  'techtour-apply-end': 'Tech Tour page: Apply (bottom)',
  'join-apply-hero': '/join: Apply (top)',
  'join-apply-end': '/join: Apply (bottom)',
  'home-join-hero': 'Home: Join (top)',
  'home-apply-hero': 'Home: Apply (top)',
  'home-join-talk': 'Home: Join (talk section)',
  'closing-join': 'Closing banner: Join',
};

type Tab = 'website' | 'applications';

const STAGE_LABELS: Record<string, string> = {
  visited: 'Visited',
  cta_click: 'Clicked a tracked button',
  form_start: 'Started a form',
  conversion: 'Converted',
};

const FUNNEL_COLORS = ['var(--cfc-f1)', 'var(--cfc-f2)', 'var(--cfc-f3)', 'var(--cfc-f4)'];

function LocaleSplit({ locales }: { locales: AnalyticsSummary['locales'] }) {
  const total = locales.reduce((a, l) => a + l.sessions, 0);
  if (total === 0) return <div className="cfc-empty-line">No data in this range.</div>;
  // en / de get the two series hues; anything else folds into a gray "Other".
  const known = locales.filter((l) => l.locale === 'en' || l.locale === 'de');
  const otherSessions = total - known.reduce((a, l) => a + l.sessions, 0);
  const segments = [
    ...known.map((l) => ({
      label: l.locale === 'en' ? 'English' : 'Deutsch',
      sessions: l.sessions,
      color: l.locale === 'en' ? 'var(--cfc-s1)' : 'var(--cfc-s2)',
    })),
    ...(otherSessions > 0
      ? [{ label: 'Other', sessions: otherSessions, color: 'var(--cfc-muted)' }]
      : []),
  ].filter((s) => s.sessions > 0);
  return (
    <div className="cfc-locales">
      <div className="cfc-locales__bar" role="img" aria-label="Sessions by site language">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.sessions / total) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="cfc-locales__legend">
        {segments.map((s) => (
          <span className="cfc-legend__item" key={s.label}>
            <span className="cfc-legend__key cfc-legend__key--rect" style={{ background: s.color }} />
            {s.label}
            <span className="cfc-locales__count">
              {fmtInt(s.sessions)} · {Math.round((s.sessions / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsDashboardClient({
  apiRoute = '/api',
  canExportSignups = false,
}: {
  apiRoute?: string;
  /** The signups CSV carries addresses: admins only (endpoints/analyticsExport.ts). */
  canExportSignups?: boolean;
}) {
  const [days, setDays] = useState(30);
  // A custom from–to window (inclusive) overrides the preset once applied.
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 29);
    return { from: isoDay(from), to: isoDay(to) };
  });
  const draftError =
    !draft.from || !draft.to
      ? 'Pick both dates.'
      : draft.from > draft.to
        ? 'The start must be before the end.'
        : draft.to > isoDay(new Date())
          ? 'The end can’t be in the future.'
          : null;
  const rangeQuery = custom ? `from=${custom.from}&to=${custom.to}` : `days=${days}`;
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [flow, setFlow] = useState<AnalyticsFlow | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [tab, setTabState] = useState<Tab>('website');
  const [apps, setApps] = useState<AnalyticsApplications | null>(null);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [appsLoading, setAppsLoading] = useState(false);

  // The tab lives in the URL (?tab=applications) so it can be linked; read
  // after mount – the server render doesn't know the query.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'applications') {
      setTabState('applications');
    }
  }, []);
  const setTab = (t: Tab) => {
    setTabState(t);
    const url = new URL(window.location.href);
    if (t === 'website') url.searchParams.delete('tab');
    else url.searchParams.set('tab', t);
    window.history.replaceState(window.history.state, '', url);
  };

  useEffect(() => {
    if (tab !== 'applications') return;
    const controller = new AbortController();
    setAppsLoading(true);
    setAppsError(null);
    fetch(`${apiRoute}/analytics/applications?${rangeQuery}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`The applications endpoint returned ${res.status}.`);
        return (await res.json()) as AnalyticsApplications;
      })
      .then((json) => {
        setApps(json);
        setAppsLoading(false);
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name === 'AbortError') return;
        setAppsError(err instanceof Error ? err.message : 'Failed to load applications.');
        setAppsLoading(false);
      });
    return () => controller.abort();
  }, [apiRoute, rangeQuery, reloadKey, tab]);

  const load = useCallback(
    (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      fetch(`${apiRoute}/analytics/summary?${rangeQuery}`, {
        credentials: 'include',
        signal,
      })
        .then(async (res) => {
          if (res.status === 401) throw new Error('Your session has expired — please log in again.');
          if (!res.ok) throw new Error(`The analytics endpoint returned ${res.status}.`);
          return (await res.json()) as AnalyticsSummary;
        })
        .then((json) => {
          setData(json);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if ((err as Error)?.name === 'AbortError') return;
          setError(err instanceof Error ? err.message : 'Failed to load analytics.');
          setLoading(false);
        });
    },
    [apiRoute, rangeQuery],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setFlowError(null);
    fetch(`${apiRoute}/analytics/flow?${rangeQuery}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`The flow endpoint returned ${res.status}.`);
        return (await res.json()) as AnalyticsFlow;
      })
      .then(setFlow)
      .catch((err: unknown) => {
        if ((err as Error)?.name === 'AbortError') return;
        setFlowError(err instanceof Error ? err.message : 'Failed to load the visitor flow.');
      });
    return () => controller.abort();
  }, [apiRoute, rangeQuery, reloadKey]);

  const csvQuery = data?.range.from && data?.range.to ? `?from=${data.range.from}&to=${data.range.to}` : '';

  const sparkSessions = useMemo(() => data?.series.map((d) => d.sessions) ?? [], [data]);
  const sparkPageviews = useMemo(() => data?.series.map((d) => d.pageviews) ?? [], [data]);
  const sparkConversions = useMemo(() => data?.series.map((d) => d.conversions) ?? [], [data]);

  return (
    <div className="cfc-analytics">
      <div className="cfc-head">
        <div>
          <h1 className="cfc-head__title">Website analytics</h1>
          <p className="cfc-head__sub">
            Cookieless first-party events — no cookies, no IP, no personal data. Do-Not-Track is
            respected.
          </p>
        </div>
        <div className="cfc-head__actions">
          <div className="cfc-range" role="group" aria-label="Date range">
            {RANGES.map((r) => {
              const on = !custom && !customOpen && r.days === days;
              return (
                <button
                  key={r.days}
                  type="button"
                  className={`cfc-range__btn ${on ? 'is-active' : ''}`}
                  aria-pressed={on}
                  onClick={() => {
                    setDays(r.days);
                    setCustom(null);
                    setCustomOpen(false);
                  }}
                >
                  {r.label}
                </button>
              );
            })}
            <button
              type="button"
              className={`cfc-range__btn ${custom || customOpen ? 'is-active' : ''}`}
              aria-pressed={Boolean(custom || customOpen)}
              onClick={() => setCustomOpen(true)}
            >
              {custom ? `${custom.from} – ${custom.to}` : 'Custom'}
            </button>
          </div>
          {customOpen && (
            <form
              className="cfc-custom"
              onSubmit={(e) => {
                e.preventDefault();
                if (draftError) return;
                setCustom({ ...draft });
                setCustomOpen(false);
              }}
            >
              <label className="cfc-select">
                <span className="cfc-select__label">From</span>
                <input
                  type="date"
                  value={draft.from}
                  max={isoDay(new Date())}
                  onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                />
              </label>
              <label className="cfc-select">
                <span className="cfc-select__label">To</span>
                <input
                  type="date"
                  value={draft.to}
                  max={isoDay(new Date())}
                  onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                />
              </label>
              <button type="submit" className="cfc-retry">
                Apply
              </button>
              <button type="button" className="cfc-linkbtn" onClick={() => setCustomOpen(false)}>
                Cancel
              </button>
              {draftError && <span className="cfc-custom__error">{draftError}</span>}
            </form>
          )}
        </div>
      </div>

      <div className="cfc-tabs" role="tablist" aria-label="Analytics section">
        {(
          [
            ['website', 'Website'],
            ['applications', 'Applications'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`cfc-tabs__tab ${tab === key ? 'is-active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'applications' && (
        <>
          {appsError && (
            <div className="cfc-card cfc-error" role="alert">
              <p>{appsError}</p>
              <button type="button" className="cfc-retry" onClick={() => setReloadKey((k) => k + 1)}>
                Try again
              </button>
            </div>
          )}
          {!apps && appsLoading && <p className="cfc-loading">Loading applications…</p>}
          {apps && (
            <div className={`cfc-grid ${appsLoading ? 'is-refetching' : ''}`}>
              <ApplicationsSection data={apps} />
            </div>
          )}
        </>
      )}

      {tab === 'website' && error && (
        <div className="cfc-card cfc-error" role="alert">
          <p>{error}</p>
          <button type="button" className="cfc-retry" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      )}

      {tab === 'website' && !data && loading && <p className="cfc-loading">Loading analytics…</p>}

      {tab === 'website' && data && (
        <div className={`cfc-grid ${loading ? 'is-refetching' : ''}`}>
          {data.totals.sessions === 0 && (
            <div className="cfc-card cfc-card--wide cfc-notice">
              No events recorded in this range yet. Data appears here as soon as the site beacons
              its first page views.
            </div>
          )}

          <StatTile
            label="Sessions"
            value={fmtCompact(data.totals.sessions)}
            spark={sparkSessions}
            delta={<Delta current={data.totals.sessions} previous={data.previous.sessions} vs={`previous ${data.range.days} days`} />}
          />
          <StatTile
            label="Page views"
            value={fmtCompact(data.totals.pageviews)}
            spark={sparkPageviews}
            delta={<Delta current={data.totals.pageviews} previous={data.previous.pageviews} vs={`previous ${data.range.days} days`} />}
          />
          <StatTile
            label="Conversions"
            value={fmtCompact(data.totals.conversions)}
            spark={sparkConversions}
            delta={<Delta current={data.totals.conversions} previous={data.previous.conversions} vs={`previous ${data.range.days} days`} />}
            caption={`incl. ${fmtInt(data.totals.signups)} waitlist signup${data.totals.signups === 1 ? '' : 's'}`}
          />
          <StatTile
            label="Conversion rate"
            value={`${data.totals.convRatePct}%`}
            delta={<Delta current={data.totals.convRatePct} previous={data.previous.convRatePct} unit="pp" vs={`previous ${data.range.days} days`} />}
            caption="conversions per session"
          />

          <Card title="Traffic over time" caption={`${data.range.from} → ${data.range.to}`} wide>
            <div className="cfc-traffic">
              <div className="cfc-traffic__chart">
                <TimeSeriesChart series={data.series} bucketHours={data.bucketHours} />
                <details className="cfc-tableview">
                  <summary>View as table</summary>
                  <table className="cfc-table">
                    <thead>
                      <tr>
                        <th>{data.bucketHours < 24 ? 'Time' : 'Day'}</th>
                        <th className="num">Sessions</th>
                        <th className="num">Page views</th>
                        <th className="num">Conversions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.series].reverse().map((d) => (
                        <tr key={d.bucket}>
                          <td>{fmtBucketRow(d.bucket, data.bucketHours)}</td>
                          <td className="num">{fmtInt(d.sessions)}</td>
                          <td className="num">{fmtInt(d.pageviews)}</td>
                          <td className="num">{fmtInt(d.conversions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </div>
              <aside className="cfc-traffic__aside">
                <div className="cfc-traffic__asidehead">
                  <h3 className="cfc-traffic__asidetitle">Sessions by source</h3>
                  <span className="cfc-card__caption">tag or referrer</span>
                </div>
                <SourceDonut share={data.sourceShare} totalSessions={data.totals.sessions} />
              </aside>
            </div>
          </Card>

          {flowError && (
            <div className="cfc-card cfc-card--wide cfc-notice">
              Visitor flow unavailable: {flowError}
            </div>
          )}
          {flow && <PathsCard flow={flow} />}

          <Card title="Funnel" caption="distinct sessions reaching each step">
            <BarList
              ariaLabel="Funnel stages"
              items={data.funnel.map((s, i) => ({
                label: STAGE_LABELS[s.stage] ?? s.stage,
                value: s.sessions,
                valueText: `${fmtInt(s.sessions)} · ${s.pctOfSessions}%`,
                color: FUNNEL_COLORS[Math.min(i, FUNNEL_COLORS.length - 1)],
              }))}
            />
            <p className="cfc-footnote">
              Also in this range: {fmtInt(data.totals.bookingsStarted)} booking flows started ·{' '}
              {fmtInt(data.totals.outboundClicks)} outbound clicks
            </p>
          </Card>

          <Card title="Channels" caption="sessions by traffic channel">
            <BarList
              ariaLabel="Sessions by channel"
              items={data.channels.map((c) => ({
                label: CHANNEL_LABELS[c.channel] ?? c.channel,
                value: c.sessions,
                valueText: `${fmtInt(c.sessions)}${c.conversions ? ` · ${fmtInt(c.conversions)} conv.` : ''}`,
              }))}
            />
          </Card>

          <Card title="Top pages" caption="views (landing + page views)">
            <BarList
              ariaLabel="Most viewed pages"
              items={data.pages.map((p) => ({
                label: p.path,
                value: p.views,
                valueText: fmtInt(p.views),
              }))}
            />
          </Card>

          <Card title="Campaigns & sources" caption="top 12 by conversions">
            {data.sources.length === 0 ? (
              <div className="cfc-empty-line">No attributed traffic in this range.</div>
            ) : (
              <div className="cfc-tablewrap">
                <table className="cfc-table">
                  <thead>
                    <tr>
                      <th>Source / referrer</th>
                      <th>Channel</th>
                      <th className="num">Sessions</th>
                      <th className="num">Form starts</th>
                      <th className="num">Conv.</th>
                      <th className="num">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sources.map((s) => (
                      <tr key={`${s.source}|${s.channel}|${s.campaign ?? ''}`}>
                        <td
                          className="cfc-table__source"
                          title={s.campaign ? `${s.source} — campaign: ${s.campaign}` : s.source}
                        >
                          {s.source}
                          {s.campaign && (
                            <span className="cfc-table__campaign"> · {s.campaign}</span>
                          )}
                        </td>
                        <td>{CHANNEL_LABELS[s.channel] ?? s.channel}</td>
                        <td className="num">{fmtInt(s.sessions)}</td>
                        <td className="num">{fmtInt(s.formStarts)}</td>
                        <td className="num">{fmtInt(s.conversions)}</td>
                        <td className="num">{s.convRatePct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Button clicks" caption="tracked buttons · page they were clicked on">
            <BarList
              ariaLabel="Clicks on tracked buttons"
              items={data.ctas.map((c) => ({
                label: `${CTA_LABELS[c.label] ?? c.label} · on ${c.path}`,
                value: c.clicks,
              }))}
            />
            {data.ctas.length === 0 && (
              <p className="cfc-footnote">
                Counted since the buttons were tagged (apply bar, navigation, apply and join
                buttons) – empty until the first clicks come in.
              </p>
            )}
          </Card>

          <Card title="Outbound clicks" caption="by destination">
            <BarList
              ariaLabel="Outbound clicks by destination"
              items={data.outbound.map((o) => ({ label: o.label, value: o.clicks }))}
            />
          </Card>

          <Card title="Site language" caption="sessions by locale" wide>
            <LocaleSplit locales={data.locales} />
          </Card>

          <footer className="cfc-foot cfc-card--wide">
            <span>
              Data through {data.range.to} · times in {data.timezone}
            </span>
            <span className="cfc-foot__links">
              Export CSV:{' '}
              <a href={`${apiRoute}/analytics/campaigns.csv${csvQuery}`}>campaigns</a> ·{' '}
              <a href={`${apiRoute}/analytics/events.csv${csvQuery}`}>events</a>
              {canExportSignups && (
                <>
                  {' · '}
                  <a href={`${apiRoute}/analytics/signups.csv${csvQuery}`}>signups</a>
                </>
              )}
            </span>
          </footer>
        </div>
      )}
    </div>
  );
}
