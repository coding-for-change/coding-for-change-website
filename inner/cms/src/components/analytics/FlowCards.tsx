'use client';
import React, { useMemo, useState } from 'react';
import type { AnalyticsFlow } from '../../endpoints/analyticsFlow';
import { FlowDiagram, FlowTable } from './FlowDiagram';
import {
  DEFAULT_FILTER,
  type FlowFilter,
  type FlowNode,
  buildFlow,
  filterOptions,
  isConversion,
  stepLabel,
  topJourneys,
} from './flowModel';
import { Card, fmtInt, pct } from './parts';

/**
 * The visitor-flow cards of /admin/analytics, both fed by the grouped visit
 * paths from GET /api/analytics/flow: the flow diagram with its filters, and
 * the most common journeys per conversion type. All counts are aggregates over
 * tab-scoped visits; nothing here shows a single visit.
 */

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="cfc-select">
      <span className="cfc-select__label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

/* ---- flow diagram ------------------------------------------------------------ */

export function FlowCard({ flow }: { flow: AnalyticsFlow }) {
  const [filter, setFilter] = useState<FlowFilter>(DEFAULT_FILTER);
  const set = (patch: Partial<FlowFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const options = useMemo(() => filterOptions(flow.paths), [flow]);
  // A filter value that no longer exists in this range falls back to "all".
  const f: FlowFilter = {
    ...filter,
    source: options.sources.some((o) => o.value === filter.source) ? filter.source : 'all',
    start: options.pages.some((o) => o.value === filter.start) ? filter.start : 'entry',
    outcome:
      ['all', 'converted', 'none'].includes(filter.outcome) ||
      options.conversions.some((o) => o.value === filter.outcome)
        ? filter.outcome
        : 'all',
  };
  // Cheap (a few thousand rows at most) – no memo needed; hover state lives
  // inside FlowDiagram, so this only reruns when a filter or the data changes.
  const graph = buildFlow(flow.paths, f);
  const isDefault =
    f.source === DEFAULT_FILTER.source &&
    f.start === DEFAULT_FILTER.start &&
    f.outcome === DEFAULT_FILTER.outcome &&
    f.depth === DEFAULT_FILTER.depth;

  const pick = (n: FlowNode) => {
    if (n.kind === 'source') set({ source: n.key.slice(1).split('|')[0] });
    else if (n.kind === 'conversion') set({ outcome: n.key });
    else if (n.kind === 'page') set({ start: n.key });
  };

  return (
    <Card title="Visitor flow" caption="how visits move through the site, step by step" wide>
      <div className="cfc-flow__bar">
        <Select label="Source" value={f.source} onChange={(v) => set({ source: v })}>
          <option value="all">All sources</option>
          {options.sources.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} ({fmtInt(o.n)})
            </option>
          ))}
        </Select>
        <Select label="Start at" value={f.start} onChange={(v) => set({ start: v })}>
          <option value="entry">Start of the visit</option>
          {options.pages.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} ({fmtInt(o.n)})
            </option>
          ))}
        </Select>
        <Select label="Visits" value={f.outcome} onChange={(v) => set({ outcome: v })}>
          <option value="all">All visits</option>
          <option value="converted">Converted (any)</option>
          {options.conversions.map((o) => (
            <option key={o.value} value={o.value}>
              ✓ {o.label} ({fmtInt(o.n)})
            </option>
          ))}
          <option value="none">Didn’t convert</option>
        </Select>
        <Select label="Steps" value={String(f.depth)} onChange={(v) => set({ depth: Number(v) })}>
          {[3, 4, 5, 6, 7].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        {!isDefault && (
          <button type="button" className="cfc-linkbtn" onClick={() => setFilter(DEFAULT_FILTER)}>
            Reset
          </button>
        )}
      </div>
      <p className="cfc-flow__stats">
        {fmtInt(graph.visits)} visits shown · {fmtInt(graph.converted)} of them converted (
        {pct(graph.converted, graph.visits)}%)
        {f.start !== 'entry' && <> · only visits that reached {f.start}, from there on</>}
      </p>

      {graph.visits === 0 ? (
        <div className="cfc-empty-line">No visits match these filters in this range.</div>
      ) : (
        <FlowDiagram graph={graph} onPick={pick} />
      )}

      <div className="cfc-flow__foot">
        <span className="cfc-legend">
          <span className="cfc-legend__item">
            <span className="cfc-legend__key cfc-legend__key--rect" style={{ background: 'var(--cfc-s1)' }} />
            page
          </span>
          <span className="cfc-legend__item">
            <span className="cfc-legend__key cfc-legend__key--rect" style={{ background: 'var(--cfc-s3)' }} />
            conversion (✓ type)
          </span>
          <span className="cfc-legend__item">
            <span className="cfc-legend__key cfc-legend__key--rect" style={{ background: 'var(--cfc-other)' }} />
            source / other
          </span>
          <span className="cfc-legend__item">
            <span className="cfc-legend__key cfc-legend__key--rect cfc-legend__key--faded" />
            faded end = left the site there
          </span>
        </span>
        <span>
          Click a page to start the flow there, a source to keep only its visits, a ✓ conversion to
          keep only visits that made it.
        </span>
      </div>
      <details className="cfc-tableview">
        <summary>View as table</summary>
        <FlowTable graph={graph} />
      </details>
      <p className="cfc-footnote">
        A visit is one browser tab – a refresh, new tab or later visit starts a new one, so paths
        across visits aren’t linked. Project and blog pages count as one page each.
      </p>
    </Card>
  );
}

/* ---- top journeys ---------------------------------------------------------- */

export function JourneysCard({ flow }: { flow: AnalyticsFlow }) {
  const [outcome, setOutcome] = useState('all');
  const options = useMemo(() => filterOptions(flow.paths), [flow]);
  const current = options.conversions.some((o) => o.value === outcome) ? outcome : 'all';
  const { rows, total, single } = useMemo(() => topJourneys(flow.paths, current), [flow, current]);
  const max = Math.max(...rows.map((r) => r.n), 1);
  const typeLabel = current === 'all' ? '' : stepLabel(current).slice(2);

  return (
    <Card
      title="Top journeys"
      caption={current === 'all' ? 'first five steps of a visit' : 'the steps that led to it'}
      wide
    >
      <div className="cfc-flow__bar">
        <Select label="Show" value={current} onChange={setOutcome}>
          <option value="all">All visits</option>
          {options.conversions.map((o) => (
            <option key={o.value} value={o.value}>
              Leading to ✓ {o.label} ({fmtInt(o.n)})
            </option>
          ))}
        </Select>
        <p className="cfc-flow__stats">
          {current === 'all'
            ? `${pct(single, total)}% of ${fmtInt(total)} visits saw only one page (not listed).`
            : `${fmtInt(total)} visits with a ${typeLabel.toLowerCase()} – share = of those.`}
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="cfc-empty-line">No data in this range.</div>
      ) : (
        <div className="cfc-bars" role="list" aria-label="Most common journeys">
          {rows.map((j) => (
            <div className="cfc-bars__row" role="listitem" key={`${j.cut}${j.steps.join('>')}${j.more}`}>
              <div className="cfc-bars__meta cfc-journey__meta">
                <span className="cfc-journey" aria-label={j.steps.map(stepLabel).join(' then ')}>
                  {j.cut && (
                    <span className="cfc-journey__arrow" aria-hidden="true">
                      … →
                    </span>
                  )}
                  {j.steps.map((s, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && (
                        <span className="cfc-journey__arrow" aria-hidden="true">
                          →
                        </span>
                      )}
                      <span className={`cfc-journey__step${isConversion(s) ? ' is-conversion' : ''}`}>
                        {stepLabel(s)}
                      </span>
                    </React.Fragment>
                  ))}
                  {j.more && (
                    <span className="cfc-journey__arrow" aria-hidden="true">
                      → …
                    </span>
                  )}
                </span>
                <span className="cfc-bars__value">
                  {fmtInt(j.n)} · {pct(j.n, total)}%
                </span>
              </div>
              <div className="cfc-bars__track">
                <div
                  className="cfc-bars__bar"
                  style={{ width: `${Math.max((j.n / max) * 100, 1)}%`, background: 'var(--cfc-s1)' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
