'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnalyticsFlow } from '../../endpoints/analyticsFlow';
import type { AnalyticsSummary } from '../../endpoints/analyticsSummary';
import { JourneysCard, OriginsCard, PageFlowCard } from './FlowCards';
import { SourceDonut } from './SourceDonut';
import { TimeSeriesChart } from './TimeSeriesChart';

/**
 * The /admin/analytics dashboard body: range filter, KPI tiles, the traffic
 * time-series with a session-share donut beside it, funnel, and
 * channel/source/page/CTA breakdowns, all fed by one
 * GET /api/analytics/summary call so every panel shows the same slice. The
 * visitor-flow cards (page flow, journeys, application origin) come from
 * GET /api/analytics/flow for the same range, fetched alongside so a failure
 * there doesn't blank the rest. Rendered inside the Payload admin
 * (DefaultTemplate) by AnalyticsDashboardView.
 */

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '12 months' },
];

const CHANNEL_LABELS: Record<string, string> = {
  campaign: 'Campaign (tagged)',
  organic_search: 'Organic search',
  social: 'Social',
  referral: 'Referral',
  direct: 'Direct',
};

const STAGE_LABELS: Record<string, string> = {
  visited: 'Visited',
  cta_click: 'Clicked a CTA',
  form_start: 'Started a form',
  conversion: 'Converted',
};

const nf = new Intl.NumberFormat('en-GB');
const nfCompact = new Intl.NumberFormat('en-GB', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const fmtInt = (v: number) => nf.format(v);
const fmtCompact = (v: number) => (v < 10000 ? nf.format(v) : nfCompact.format(v));

/** Table row label for a series bucket: the date, plus hours when intraday. */
const fmtBucketRow = (bucket: string, bucketHours: number): string => {
  if (bucketHours >= 24) return bucket.slice(0, 10);
  const from = Number(bucket.slice(11, 13));
  const to = (from + bucketHours) % 24;
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${bucket.slice(0, 10)} ${pad(from)}:00–${pad(to)}:00`;
};

/** Sum an array into at most `buckets` points (sparkline downsampling). */
function downsample(values: number[], buckets = 12): number[] {
  if (values.length <= buckets) return values;
  const size = values.length / buckets;
  const out: number[] = [];
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * size);
    const end = Math.max(Math.floor((b + 1) * size), start + 1);
    out.push(values.slice(start, end).reduce((a, v) => a + v, 0));
  }
  return out;
}

function Sparkline({ values }: { values: number[] }) {
  const points = downsample(values);
  const W = 96;
  const H = 28;
  const PAD = 3;
  const max = Math.max(...points, 1);
  const x = (i: number) =>
    PAD + (points.length <= 1 ? (W - 2 * PAD) / 2 : (i * (W - 2 * PAD)) / (points.length - 1));
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = points.length - 1;
  return (
    <svg width={W} height={H} className="cfc-spark" aria-hidden="true">
      <path d={d} fill="none" stroke="var(--cfc-muted)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(last)} cy={y(points[last])} r={3} fill="var(--cfc-s1)" stroke="var(--cfc-surface)" strokeWidth={2} />
    </svg>
  );
}

function Delta({
  current,
  previous,
  unit = '%',
  vs,
}: {
  current: number;
  previous: number;
  /** '%' = relative change of counts; 'pp' = absolute difference of two rates. */
  unit?: '%' | 'pp';
  vs: string;
}) {
  let text: string;
  let dir: 0 | 1 | -1 = 0;
  if (unit === 'pp') {
    const diff = Math.round((current - previous) * 10) / 10;
    dir = diff > 0 ? 1 : diff < 0 ? -1 : 0;
    text = `${diff > 0 ? '+' : ''}${diff} pp`;
  } else if (previous === 0) {
    if (current === 0) {
      return <span className="cfc-tile__delta cfc-tile__delta--flat">— vs {vs}</span>;
    }
    text = 'new';
    dir = 1;
  } else {
    const pct = Math.round(((current - previous) / previous) * 1000) / 10;
    dir = pct > 0 ? 1 : pct < 0 ? -1 : 0;
    text = `${pct > 0 ? '+' : ''}${pct}%`;
  }
  const cls =
    dir > 0 ? 'cfc-tile__delta--up' : dir < 0 ? 'cfc-tile__delta--down' : 'cfc-tile__delta--flat';
  return (
    <span className={`cfc-tile__delta ${cls}`}>
      {dir !== 0 && <span aria-hidden="true">{dir > 0 ? '▲' : '▼'} </span>}
      {text} vs {vs}
    </span>
  );
}

function StatTile({
  label,
  value,
  delta,
  caption,
  spark,
}: {
  label: string;
  value: string;
  delta?: React.ReactNode;
  caption?: string;
  spark?: number[];
}) {
  return (
    <div className="cfc-card cfc-tile">
      <div className="cfc-tile__label">{label}</div>
      <div className="cfc-tile__row">
        <span className="cfc-tile__value">{value}</span>
        {spark && spark.some((v) => v > 0) && <Sparkline values={spark} />}
      </div>
      {delta}
      {caption && <div className="cfc-tile__caption">{caption}</div>}
    </div>
  );
}

type BarItem = {
  label: string;
  value: number;
  valueText?: string;
  color?: string;
};

/** Labeled horizontal bar rows — every value is printed, bars reinforce. */
function BarList({ items, ariaLabel }: { items: BarItem[]; ariaLabel: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="cfc-bars" role="list" aria-label={ariaLabel}>
      {items.map((item) => (
        <div className="cfc-bars__row" role="listitem" key={item.label}>
          <div className="cfc-bars__meta">
            <span className="cfc-bars__label" title={item.label}>
              {item.label}
            </span>
            <span className="cfc-bars__value">{item.valueText ?? fmtInt(item.value)}</span>
          </div>
          <div className="cfc-bars__track">
            <div
              className="cfc-bars__bar"
              style={{
                width: `${Math.max((item.value / max) * 100, item.value > 0 ? 1 : 0)}%`,
                background: item.color ?? 'var(--cfc-s1)',
              }}
            />
          </div>
        </div>
      ))}
      {items.length === 0 && <div className="cfc-empty-line">No data in this range.</div>}
    </div>
  );
}

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

function Card({
  title,
  caption,
  wide,
  children,
}: {
  title: string;
  caption?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`cfc-card ${wide ? 'cfc-card--wide' : 'cfc-card--half'}`}>
      <header className="cfc-card__head">
        <h2 className="cfc-card__title">{title}</h2>
        {caption && <span className="cfc-card__caption">{caption}</span>}
      </header>
      {children}
    </section>
  );
}

export function AnalyticsDashboardClient({ apiRoute = '/api' }: { apiRoute?: string }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [flow, setFlow] = useState<AnalyticsFlow | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [flowPage, setFlowPage] = useState<string | null>(null);

  const load = useCallback(
    (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      fetch(`${apiRoute}/analytics/summary?days=${days}`, {
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
    [apiRoute, days],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setFlowError(null);
    fetch(`${apiRoute}/analytics/flow?days=${days}`, {
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
  }, [apiRoute, days, reloadKey]);

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
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                className={`cfc-range__btn ${r.days === days ? 'is-active' : ''}`}
                aria-pressed={r.days === days}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="cfc-card cfc-error" role="alert">
          <p>{error}</p>
          <button type="button" className="cfc-retry" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </div>
      )}

      {!data && loading && <p className="cfc-loading">Loading analytics…</p>}

      {data && (
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
          {flow && (
            <>
              <PageFlowCard pages={flow.pages} selected={flowPage} onSelect={setFlowPage} />
              <OriginsCard origins={flow.origins} />
              <JourneysCard journeys={flow.journeys} />
            </>
          )}

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

          <Card title="CTA clicks" caption="by button · page clicked on">
            <BarList
              ariaLabel="CTA clicks by label"
              items={data.ctas.map((c) => ({ label: `${c.label} · ${c.path}`, value: c.clicks }))}
            />
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
              <a href={`${apiRoute}/analytics/events.csv${csvQuery}`}>events</a> ·{' '}
              <a href={`${apiRoute}/analytics/signups.csv${csvQuery}`}>signups</a>
            </span>
          </footer>
        </div>
      )}
    </div>
  );
}
