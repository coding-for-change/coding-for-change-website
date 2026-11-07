'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { AnalyticsApplications, AppKind, AppOrigin } from '../../endpoints/analyticsApplications';
import { Card, Delta, StatTile, fmtInt, pct } from './parts';

/**
 * The "Applications" section of /admin/analytics, fed by
 * GET /api/analytics/applications: how many membership applications, speedrun
 * applications and Tech Tour registrations came in, over time, from which
 * sources and entry pages, whether the visit saw the Tech Tour or /join first,
 * and how many who opened a form sent it.
 */

const KIND_LABEL: Record<AppKind, string> = {
  membership: 'Membership applications',
  speedrun: 'Speedrun applications',
  techtour: 'Tech Tour registrations',
};
const KIND_SHORT: Record<AppKind, string> = {
  membership: 'Membership',
  speedrun: 'Speedrun',
  techtour: 'Tech Tour',
};
/** Categorical slots in fixed order: membership 1 (blue), Tech Tour 2 (orange), speedrun 3. */
const KIND_COLOR: Record<AppKind, string> = {
  membership: 'var(--cfc-s1)',
  techtour: 'var(--cfc-s2)',
  speedrun: 'var(--cfc-s3)',
};
const KIND_ORDER: AppKind[] = ['membership', 'techtour', 'speedrun'];

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/* ---- stacked bars over time ------------------------------------------------- */

function StackedBars({
  data,
  kinds,
  weekly,
}: {
  data: AnalyticsApplications['series'];
  kinds: AppKind[];
  weekly: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 220;
  const PL = 32;
  const PB = 22;
  const PT = 8;
  const totals = data.map((d) => kinds.reduce((a, k) => a + d[k], 0));
  const rawMax = Math.max(...totals, 1);
  const step = rawMax <= 4 ? 1 : Math.ceil(rawMax / 4);
  const max = step * Math.ceil(rawMax / step);
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  const plotW = Math.max(width - PL, 100);
  const slot = plotW / Math.max(data.length, 1);
  const barW = Math.max(Math.min(slot - 2, 28), 2);
  const y = (v: number) => PT + (H - PT - PB) * (1 - v / max);
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div className="cfc-chart" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg width={width} height={H} role="img" aria-label="Applications per period, stacked by type">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={width} y1={y(t)} y2={y(t)} stroke="var(--cfc-grid)" />
            <text x={PL - 6} y={y(t)} dy="0.35em" textAnchor="end" className="cfc-chart__tick">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PL + i * slot + (slot - barW) / 2;
          let acc = 0;
          const parts = kinds.filter((k) => d[k] > 0);
          return (
            <g key={d.bucket} onMouseEnter={() => setHover(i)}>
              <rect x={PL + i * slot} y={PT} width={slot} height={H - PT - PB} fill="transparent" />
              {parts.map((k, j) => {
                const top = y(acc + d[k]);
                const h = y(acc) - top;
                acc += d[k];
                const isTop = j === parts.length - 1;
                return (
                  <rect
                    key={k}
                    x={x}
                    y={top + (j > 0 ? 1 : 0)}
                    width={barW}
                    height={Math.max(h - (j > 0 ? 1 : 0), 1)}
                    rx={isTop ? 2 : 0}
                    fill={KIND_COLOR[k]}
                    opacity={hover === null || hover === i ? 1 : 0.55}
                  />
                );
              })}
              {i % labelEvery === 0 && (
                <text x={PL + i * slot + slot / 2} y={H - 6} textAnchor="middle" className="cfc-chart__tick">
                  {fmtDay(d.bucket)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PL} x2={width} y1={y(0)} y2={y(0)} stroke="var(--cfc-axis)" />
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="cfc-tooltip"
          style={{ left: Math.min(PL + hover * slot + slot / 2 + 10, Math.max(width - 200, 0)), top: 8 }}
        >
          <div className="cfc-tooltip__date">
            {weekly ? `Week of ${fmtDay(data[hover].bucket)}` : fmtDay(data[hover].bucket)}
          </div>
          {kinds.map((k) => (
            <div className="cfc-tooltip__row" key={k}>
              <span className="cfc-legend__key cfc-legend__key--rect" style={{ background: KIND_COLOR[k] }} />
              <span className="cfc-tooltip__label">{KIND_SHORT[k]}</span>
              <span className="cfc-tooltip__value">{fmtInt(data[hover][k])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Tech Tour or /join first ------------------------------------------------- */

/** Two arms: orange = Tech Tour, blue = /join; strong = only that program, light = crossed over. */
const SEGMENTS: Array<{ key: 'ttOnly' | 'ttFirst' | 'joinFirst' | 'joinOnly'; label: string; cls: string }> = [
  { key: 'ttOnly', label: 'Only Tech Tour pages', cls: 'tt' },
  { key: 'ttFirst', label: 'Tech Tour first, then /join', cls: 'ttx' },
  { key: 'joinFirst', label: '/join first, then Tech Tour', cls: 'joinx' },
  { key: 'joinOnly', label: 'Only /join pages', cls: 'join' },
];

const VIA_OTHER: Record<AppKind, string> = {
  membership: 'sent with the membership tick-box on the Tech Tour form',
  speedrun: 'sent from the Tech Tour form',
  techtour: 'sent with the Tech Tour tick-box on the membership form',
};

function OriginCard({ origins }: { origins: AppOrigin[] }) {
  return (
    <Card title="Tech Tour or /join first?" caption="program pages the visit saw before sending">
      <div className="cfc-legend cfc-origin__legend">
        {SEGMENTS.map((s) => (
          <span className="cfc-legend__item" key={s.key}>
            <span className={`cfc-legend__key cfc-legend__key--rect cfc-origin__seg--${s.cls}`} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="cfc-origin">
        {origins.map((o) => (
          <div className="cfc-origin__row" key={o.kind}>
            <div className="cfc-bars__meta">
              <span className="cfc-bars__label">{KIND_LABEL[o.kind]}</span>
              <span className="cfc-bars__value">{fmtInt(o.known + o.unknown)}</span>
            </div>
            {o.known > 0 ? (
              <div
                className="cfc-origin__bar"
                role="img"
                aria-label={SEGMENTS.map((s) => `${s.label}: ${o[s.key]}`).join(', ')}
              >
                {SEGMENTS.filter((s) => o[s.key] > 0).map((s) => {
                  const share = pct(o[s.key], o.known);
                  return (
                    <div
                      key={s.key}
                      className={`cfc-origin__seg cfc-origin__seg--${s.cls}`}
                      style={{ flexGrow: o[s.key] }}
                      title={`${s.label}: ${fmtInt(o[s.key])} (${share}%)`}
                    >
                      {share >= 9 && <span>{share}%</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="cfc-empty-line">No page data in this range.</div>
            )}
            {(o.viaOtherForm > 0 || o.unknown > 0) && (
              <div className="cfc-origin__note">
                {o.viaOtherForm > 0 && (
                  <>
                    {fmtInt(o.viaOtherForm)} {VIA_OTHER[o.kind]}
                  </>
                )}
                {o.viaOtherForm > 0 && o.unknown > 0 && ' · '}
                {o.unknown > 0 && <>{fmtInt(o.unknown)} without page data (Do-Not-Track)</>}
              </div>
            )}
          </div>
        ))}
      </div>
      <details className="cfc-tableview">
        <summary>View as table</summary>
        <table className="cfc-table">
          <thead>
            <tr>
              <th>Application</th>
              {SEGMENTS.map((s) => (
                <th className="num" key={s.key}>
                  {s.label}
                </th>
              ))}
              <th className="num">No page data</th>
            </tr>
          </thead>
          <tbody>
            {origins.map((o) => (
              <tr key={o.kind}>
                <td>{KIND_LABEL[o.kind]}</td>
                {SEGMENTS.map((s) => (
                  <td className="num" key={s.key}>
                    {fmtInt(o[s.key])}
                  </td>
                ))}
                <td className="num">{fmtInt(o.unknown)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="cfc-footnote">
        Tech Tour pages = /techtour/*, /join pages = /join/*, within the same browser tab up to the
        moment the form was sent.
      </p>
    </Card>
  );
}

/* ---- funnel ------------------------------------------------------------------ */

type Stage = { label: string; n: number; note?: string };

/**
 * A real funnel per form: on the website (visits: saw the form → started →
 * sent it there), then what happened to the submissions (all of them: review
 * accepted = interview invitation; Tech Tour: admitted by a host).
 */
function FunnelCard({ funnel }: { funnel: AnalyticsApplications['funnel'] }) {
  const [kind, setKind] = useState<AppKind>(funnel[0]?.kind ?? 'membership');
  const f = funnel.find((x) => x.kind === kind) ?? funnel[0];
  if (!f) return null;
  const web: Stage[] = [
    { label: 'Saw the form', n: f.views },
    { label: 'Started filling it in', n: f.starts, note: 'a field was focused' },
    { label: 'Sent it', n: f.sent },
  ];
  const after: Stage[] =
    f.kind === 'techtour'
      ? [
          { label: 'All registrations', n: f.submissions, note: 'incl. tick-box and Do-Not-Track' },
          { label: 'Admitted by a host', n: f.hostAdmitted, note: 'to at least one evening' },
        ]
      : [
          { label: 'All applications', n: f.submissions, note: 'incl. tick-box and Do-Not-Track' },
          { label: 'Invited to interview', n: f.accepted, note: 'review status “Accepted”' },
        ];
  const max = Math.max(f.views, f.submissions, 1);
  const row = (s: Stage, prev: number | null) => (
    <div className="cfc-funnel__row" key={s.label}>
      <div className="cfc-funnel__meta">
        <span>
          {s.label}
          {s.note && <span className="cfc-funnel__note"> · {s.note}</span>}
        </span>
        <span className="cfc-funnel__num">
          <strong>{fmtInt(s.n)}</strong>
          {prev !== null && <span className="cfc-funnel__step"> {pct(s.n, prev)}% of the step before</span>}
        </span>
      </div>
      <div className="cfc-funnel__track">
        <div
          className="cfc-funnel__bar"
          style={{ width: `${Math.max((s.n / max) * 100, s.n ? 1 : 0)}%`, background: KIND_COLOR[f.kind] }}
        />
      </div>
    </div>
  );
  return (
    <Card title="Funnel" caption="from seeing the form to the decision">
      {funnel.length > 1 && (
        <div className="cfc-flow__bar">
          <div className="cfc-range cfc-range--small" role="group" aria-label="Form">
            {funnel.map((x) => (
              <button
                key={x.kind}
                type="button"
                className={`cfc-range__btn ${x.kind === f.kind ? 'is-active' : ''}`}
                aria-pressed={x.kind === f.kind}
                onClick={() => setKind(x.kind)}
              >
                {KIND_SHORT[x.kind]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="cfc-funnel">
        <div className="cfc-funnel__part">On the website</div>
        {web.map((s, i) => row(s, i === 0 ? null : web[i - 1].n))}
        <div className="cfc-funnel__part">After sending</div>
        {after.map((s, i) => row(s, i === 0 ? null : after[i - 1].n))}
      </div>
      <p className="cfc-footnote">
        Website steps come from page events (no Do-Not-Track visitors) and count visits on this
        form’s page. The steps after sending count every submission in the range, by its current
        status. Interviews held and admissions aren’t recorded yet.
      </p>
    </Card>
  );
}

/* ---- the section --------------------------------------------------------------- */

function KindTable<T extends { total: number } & Record<AppKind, number>>({
  rows,
  kinds,
  first,
  firstCell,
  extra,
}: {
  rows: T[];
  kinds: AppKind[];
  first: string;
  firstCell: (r: T) => React.ReactNode;
  extra?: { head: string; cell: (r: T) => React.ReactNode };
}) {
  if (rows.length === 0) return <div className="cfc-empty-line">No applications in this range.</div>;
  return (
    <div className="cfc-tablewrap">
      <table className="cfc-table">
        <thead>
          <tr>
            <th>{first}</th>
            {extra && <th>{extra.head}</th>}
            {kinds.map((k) => (
              <th className="num" key={k}>
                {KIND_SHORT[k]}
              </th>
            ))}
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="cfc-table__source">{firstCell(r)}</td>
              {extra && <td>{extra.cell(r)}</td>}
              {kinds.map((k) => (
                <td className="num" key={k}>
                  {r[k] ? fmtInt(r[k]) : '–'}
                </td>
              ))}
              <td className="num">{fmtInt(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CHANNEL_NAMES: Record<string, string> = {
  campaign: 'Campaign (tagged)',
  organic_search: 'Organic search',
  social: 'Social',
  referral: 'Referral',
  direct: 'Direct',
  unknown: '–',
};

export function ApplicationsSection({ data }: { data: AnalyticsApplications }) {
  // Speedrun ran for a few weeks only – hide it in ranges that never saw one.
  const kinds = KIND_ORDER.filter(
    (k) => k !== 'speedrun' || data.totals.speedrun.current > 0 || data.totals.speedrun.previous > 0,
  );
  const vs = `previous ${data.range.days} days`;
  const all = kinds.reduce(
    (a, k) => ({ current: a.current + data.totals[k].current, previous: a.previous + data.totals[k].previous }),
    { current: 0, previous: 0 },
  );
  const tileCls = kinds.length === 3 ? '' : 'cfc-tile--third';

  return (
    <>
      {kinds.map((k) => (
        <StatTile
          key={k}
          className={tileCls}
          label={KIND_LABEL[k]}
          value={fmtInt(data.totals[k].current)}
          spark={data.series.map((d) => d[k])}
          delta={<Delta current={data.totals[k].current} previous={data.totals[k].previous} vs={vs} />}
        />
      ))}
      <StatTile
        className={tileCls}
        label="All applications"
        value={fmtInt(all.current)}
        delta={<Delta current={all.current} previous={all.previous} vs={vs} />}
        caption="every submission counts, incl. Do-Not-Track visitors"
      />

      <Card title="Applications over time" caption={data.bucket === 'week' ? 'per week' : 'per day'} wide>
        <div className="cfc-legend">
          {kinds.map((k) => (
            <span className="cfc-legend__item" key={k}>
              <span className="cfc-legend__key cfc-legend__key--rect" style={{ background: KIND_COLOR[k] }} />
              {KIND_SHORT[k]}
            </span>
          ))}
        </div>
        <StackedBars data={data.series} kinds={kinds} weekly={data.bucket === 'week'} />
      </Card>

      <OriginCard origins={data.origins.filter((o) => kinds.includes(o.kind))} />

      <FunnelCard funnel={data.funnel.filter((f) => kinds.includes(f.kind))} />

      <Card title="Where applicants came from" caption="campaign tag or referrer of the visit that sent it">
        <KindTable
          rows={data.sources}
          kinds={kinds}
          first="Source"
          firstCell={(r) => (
            <span title={r.source}>{r.source === '(direct)' ? 'Direct / unknown' : r.source}</span>
          )}
          extra={{ head: 'Channel', cell: (r) => CHANNEL_NAMES[r.channel] ?? r.channel }}
        />
      </Card>

      <Card title="Entry page" caption="first page of the visit that sent it">
        <KindTable rows={data.landing} kinds={kinds} first="Page" firstCell={(r) => r.path} />
      </Card>
    </>
  );
}
