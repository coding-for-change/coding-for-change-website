'use client';
import React, { useState } from 'react';
import type {
  AnalyticsFlow,
  FlowEdge,
  FlowPage,
  Journey,
  Origin,
  OriginKind,
} from '../../endpoints/analyticsFlow';
import { CHANNEL_TAGS } from './SourceDonut';

/**
 * The visitor-flow cards of /admin/analytics, fed by GET /api/analytics/flow:
 * page flow (where from / where next for one page), top journeys, and where
 * applications come from (Tech Tour pages vs /join pages). All counts are
 * aggregates over tab-scoped sessions; nothing here shows a single visit.
 */

const nf = new Intl.NumberFormat('en-GB');
const fmtInt = (v: number) => nf.format(v);
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

function CardShell({
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

/* ---- page flow ----------------------------------------------------------- */

function edgeLabel(e: FlowEdge): React.ReactNode {
  if (e.kind === 'exit') return 'Left the site';
  if (e.kind === 'other') return 'Everything else';
  if (e.kind === 'entry') {
    if (e.label === '(direct)') return 'Entered here directly';
    const tag = e.channel ? CHANNEL_TAGS[e.channel] : '';
    return (
      <>
        Entered from {e.label}
        {tag && <span className="cfc-donut__chan"> · {tag}</span>}
      </>
    );
  }
  return e.label;
}

function FlowList({
  edges,
  total,
  known,
  onPick,
  ariaLabel,
}: {
  edges: FlowEdge[];
  total: number;
  /** Pages that have their own flow and can be clicked through to. */
  known: Set<string>;
  onPick: (path: string) => void;
  ariaLabel: string;
}) {
  const max = Math.max(...edges.map((e) => e.count), 1);
  if (edges.length === 0) return <div className="cfc-empty-line">No data in this range.</div>;
  return (
    <div className="cfc-bars" role="list" aria-label={ariaLabel}>
      {edges.map((e) => {
        const clickable = e.kind === 'page' && known.has(e.label);
        const inner = (
          <>
            <div className="cfc-bars__meta">
              <span className="cfc-bars__label">{edgeLabel(e)}</span>
              <span className="cfc-bars__value">
                {fmtInt(e.count)} · {pct(e.count, total)}%
              </span>
            </div>
            <div className="cfc-bars__track">
              <div
                className="cfc-bars__bar"
                style={{
                  width: `${Math.max((e.count / max) * 100, e.count > 0 ? 1 : 0)}%`,
                  background: e.kind === 'page' ? 'var(--cfc-s1)' : 'var(--cfc-other)',
                }}
              />
            </div>
          </>
        );
        return (
          <div
            className="cfc-bars__row"
            role="listitem"
            key={`${e.kind}|${e.label}|${e.channel ?? ''}`}
          >
            {clickable ? (
              <button
                type="button"
                className="cfc-flow__pick"
                onClick={() => onPick(e.label)}
                title={`Show the flow around ${e.label}`}
              >
                {inner}
              </button>
            ) : (
              inner
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PageFlowCard({
  pages,
  selected,
  onSelect,
}: {
  pages: FlowPage[];
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const page = pages.find((p) => p.path === selected) ?? pages[0];
  const known = new Set(pages.map((p) => p.path));
  return (
    <CardShell
      title="Page flow"
      caption="where visitors came from and where they went next, within one visit"
      wide
    >
      {!page ? (
        <div className="cfc-empty-line">No page views in this range.</div>
      ) : (
        <>
          <div className="cfc-flow__bar">
            <label className="cfc-select">
              <span className="cfc-select__label">Page</span>
              <select value={page.path} onChange={(e) => onSelect(e.target.value)}>
                {pages.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.path} ({fmtInt(p.views)})
                  </option>
                ))}
              </select>
            </label>
            <p className="cfc-flow__stats">
              {fmtInt(page.views)} views · {fmtInt(page.entries)} entered the site here ·{' '}
              {fmtInt(page.exits)} left from here ({pct(page.exits, page.views)}%)
              {page.submissions > 0 && (
                <> · {fmtInt(page.submissions)} visits sent a form here</>
              )}
            </p>
          </div>

          <div className="cfc-flow">
            <div className="cfc-flow__col">
              <h3 className="cfc-flow__coltitle">Came from</h3>
              <FlowList
                edges={page.from}
                total={page.views}
                known={known}
                onPick={onSelect}
                ariaLabel={`Where visitors to ${page.path} came from`}
              />
            </div>
            <div className="cfc-flow__node" aria-hidden="true">
              <span className="cfc-flow__arrow">→</span>
              <div className="cfc-flow__page">
                <strong>{page.path}</strong>
                <span>{fmtInt(page.views)} views</span>
              </div>
              <span className="cfc-flow__arrow">→</span>
            </div>
            <div className="cfc-flow__col">
              <h3 className="cfc-flow__coltitle">Went next</h3>
              <FlowList
                edges={page.next}
                total={page.views}
                known={known}
                onPick={onSelect}
                ariaLabel={`Where visitors went after ${page.path}`}
              />
            </div>
          </div>

          <div className="cfc-flow__foot">
            <span className="cfc-legend">
              <span className="cfc-legend__item">
                <span className="cfc-legend__key cfc-legend__key--rect" style={{ background: 'var(--cfc-s1)' }} />
                page on the site (click to follow)
              </span>
              <span className="cfc-legend__item">
                <span className="cfc-legend__key cfc-legend__key--rect" style={{ background: 'var(--cfc-other)' }} />
                entry, exit or the rest
              </span>
            </span>
            <span>
              A visit is one browser tab – a refresh, new tab or later visit starts a new one, so
              paths across visits aren’t linked. Project and blog pages count as one page each.
            </span>
          </div>
        </>
      )}
    </CardShell>
  );
}

/* ---- top journeys ---------------------------------------------------------- */

function JourneyRow({
  journey,
  value,
  max,
  valueText,
}: {
  journey: Journey;
  value: number;
  max: number;
  valueText: string;
}) {
  return (
    <div className="cfc-bars__row" role="listitem">
      <div className="cfc-bars__meta cfc-journey__meta">
        <span className="cfc-journey" aria-label={journey.steps.join(' then ') + (journey.more ? ', then more' : '')}>
          {journey.steps.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <span className="cfc-journey__arrow" aria-hidden="true">
                  →
                </span>
              )}
              <span className="cfc-journey__step">{s}</span>
            </React.Fragment>
          ))}
          {journey.more && (
            <span className="cfc-journey__arrow" aria-hidden="true">
              → …
            </span>
          )}
        </span>
        <span className="cfc-bars__value">{valueText}</span>
      </div>
      <div className="cfc-bars__track">
        <div
          className="cfc-bars__bar"
          style={{ width: `${Math.max((value / max) * 100, value > 0 ? 1 : 0)}%`, background: 'var(--cfc-s1)' }}
        />
      </div>
    </div>
  );
}

export function JourneysCard({ journeys }: { journeys: AnalyticsFlow['journeys'] }) {
  const [mode, setMode] = useState<'all' | 'converted'>('all');
  const list = mode === 'all' ? journeys.all : journeys.converted;
  const valueOf = (j: Journey) => (mode === 'all' ? j.sessions : j.converted);
  const max = Math.max(...list.map(valueOf), 1);
  return (
    <CardShell title="Top journeys" caption="first four pages of a visit">
      <div className="cfc-flow__bar">
        <div className="cfc-range cfc-range--small" role="group" aria-label="Which visits">
          {(
            [
              ['all', 'All visits'],
              ['converted', 'Visits that converted'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`cfc-range__btn ${mode === key ? 'is-active' : ''}`}
              aria-pressed={mode === key}
              onClick={() => setMode(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="cfc-flow__stats">
          {mode === 'all'
            ? `${pct(journeys.singlePage, journeys.sessions)}% of ${fmtInt(journeys.sessions)} visits saw only one page (not listed).`
            : `${fmtInt(journeys.convertedSessions)} visits sent a form; rate = share of that journey’s visits.`}
        </p>
      </div>
      {list.length === 0 ? (
        <div className="cfc-empty-line">No data in this range.</div>
      ) : (
        <div className="cfc-bars" role="list" aria-label="Most common journeys">
          {list.map((j) => (
            <JourneyRow
              key={`${j.steps.join('>')}${j.more ? '…' : ''}`}
              journey={j}
              value={valueOf(j)}
              max={max}
              valueText={
                mode === 'all'
                  ? `${fmtInt(j.sessions)}${j.converted ? ` · ${fmtInt(j.converted)} conv.` : ''}`
                  : `${fmtInt(j.converted)} conv. · ${pct(j.converted, j.sessions)}%`
              }
            />
          ))}
        </div>
      )}
    </CardShell>
  );
}

/* ---- where applications come from ---------------------------------------- */

const KIND_LABELS: Record<OriginKind, string> = {
  membership: 'Membership applications',
  speedrun: 'Speedrun applications',
  techtour: 'Tech Tour registrations',
};

const VIA_OTHER: Record<OriginKind, string> = {
  membership: 'sent with the membership tick-box on the Tech Tour form',
  speedrun: 'sent from another form',
  techtour: 'sent with the Tech Tour tick-box on the membership form',
};

/** Segments in order: Tech Tour arm (orange) → crossover → /join arm (blue). */
const SEGMENTS: Array<{ key: keyof Origin; label: string; cls: string }> = [
  { key: 'ttOnly', label: 'Only Tech Tour pages', cls: 'tt' },
  { key: 'ttFirst', label: 'Tech Tour first, then /join', cls: 'ttx' },
  { key: 'joinFirst', label: '/join first, then Tech Tour', cls: 'joinx' },
  { key: 'joinOnly', label: 'Only /join pages', cls: 'join' },
];

export function OriginsCard({ origins }: { origins: Origin[] }) {
  const any = origins.some((o) => o.total > 0);
  return (
    <CardShell title="Where applications come from" caption="program pages seen before sending, same visit">
      <div className="cfc-legend cfc-origin__legend">
        {SEGMENTS.map((s) => (
          <span className="cfc-legend__item" key={s.key}>
            <span className={`cfc-legend__key cfc-legend__key--rect cfc-origin__seg--${s.cls}`} />
            {s.label}
          </span>
        ))}
      </div>
      {!any ? (
        <div className="cfc-empty-line">No applications in this range.</div>
      ) : (
        <div className="cfc-origin">
          {origins.map((o) => (
            <div className="cfc-origin__row" key={o.kind}>
              <div className="cfc-bars__meta">
                <span className="cfc-bars__label">{KIND_LABELS[o.kind]}</span>
                <span className="cfc-bars__value">{fmtInt(o.total)}</span>
              </div>
              {o.total > 0 ? (
                <div className="cfc-origin__bar" role="img" aria-label={SEGMENTS.map((s) => `${s.label}: ${o[s.key]}`).join(', ')}>
                  {SEGMENTS.filter((s) => (o[s.key] as number) > 0).map((s) => {
                    const n = o[s.key] as number;
                    const share = pct(n, o.total);
                    return (
                      <div
                        key={s.key}
                        className={`cfc-origin__seg cfc-origin__seg--${s.cls}`}
                        style={{ flexGrow: n }}
                        title={`${s.label}: ${fmtInt(n)} (${share}%)`}
                      >
                        {share >= 9 && <span>{share}%</span>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="cfc-empty-line">None in this range.</div>
              )}
              {o.viaOtherForm > 0 && (
                <div className="cfc-origin__note">
                  {fmtInt(o.viaOtherForm)} of these {VIA_OTHER[o.kind]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {origins.map((o) => (
              <tr key={o.kind}>
                <td>{KIND_LABELS[o.kind]}</td>
                {SEGMENTS.map((s) => (
                  <td className="num" key={s.key}>
                    {fmtInt(o[s.key] as number)}
                  </td>
                ))}
                <td className="num">{fmtInt(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="cfc-footnote">
        Tech Tour pages = /techtour/*, /join pages = /join/*. Counted up to the moment the form was
        sent, within the same browser tab.
      </p>
    </CardShell>
  );
}
