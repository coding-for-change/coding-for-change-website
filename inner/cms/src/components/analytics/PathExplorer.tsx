'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalyticsFlow } from '../../endpoints/analyticsFlow';
import {
  type ExplorerOption,
  columnsFor,
  conversionOptions,
  extendCommon,
  isConversion,
  pickable,
  sourceLabel,
  stepLabel,
  topJourneys,
} from './flowModel';
import { Card, fmtInt } from './parts';

/**
 * "Visitor paths" on /admin/analytics: a path explorer plus the most common
 * paths, both from GET /api/analytics/flow.
 *
 * The explorer is a row of columns – source → entry page → step 2 → … – where
 * each column shows what the visits selected so far did next, in % of them.
 * Out of the box (and after every click) the most common continuation is
 * pre-selected and marked "suggested", so there is always a full path on
 * screen; a click on any other card follows that branch instead. The common
 * paths below load into the explorer on click.
 */

const fmtPct = (p: number) => `${p < 10 ? p.toFixed(1) : Math.round(p)}%`;

const BAR: Record<ExplorerOption['kind'], string> = {
  source: 'var(--cfc-other)',
  page: 'var(--cfc-s1)',
  conversion: 'var(--cfc-s3)',
  other: 'var(--cfc-muted)',
  exit: 'var(--cfc-axis)',
};

function useColumnsThatFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setFit(Math.min(5, Math.max(2, Math.floor(e.contentRect.width / 230)))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, fit] as const;
}

function OptionCard({
  o,
  selected,
  suggested,
  onPick,
}: {
  o: ExplorerOption;
  selected: boolean;
  suggested: boolean;
  onPick: () => void;
}) {
  const can = pickable(o);
  const inner = (
    <>
      <span className="cfc-pe__meta">
        <span className={`cfc-pe__label cfc-pe__label--${o.kind}`} title={o.label}>
          {o.label}
        </span>
        <span className="cfc-pe__num">
          {fmtPct(o.pct)} · {fmtInt(o.n)}
        </span>
      </span>
      <span className="cfc-pe__track">
        <span className="cfc-pe__fill" style={{ width: `${Math.max(o.pct, o.n ? 1 : 0)}%`, background: BAR[o.kind] }} />
      </span>
      {selected && suggested && <span className="cfc-pe__hint">suggested · most common</span>}
    </>
  );
  if (!can) return <div className="cfc-pe__card is-static">{inner}</div>;
  return (
    <button
      type="button"
      className={`cfc-pe__card${selected ? (suggested ? ' is-suggested' : ' is-selected') : ''}`}
      aria-pressed={selected}
      onClick={onPick}
    >
      {inner}
    </button>
  );
}

export function PathsCard({ flow }: { flow: AnalyticsFlow }) {
  const [wrapRef, fit] = useColumnsThatFit();
  const paths = flow.paths;
  // Selection = [source, step1, step2, …]; the first `picked` were clicked,
  // the rest are the suggested continuation.
  const [sel, setSel] = useState<string[]>(['all']);
  const [picked, setPicked] = useState(1);
  const [outcome, setOutcome] = useState('all');
  const [showAll, setShowAll] = useState(false);

  // Refs so the effects below read the latest values without re-running on them.
  const fitRef = useRef(fit);
  fitRef.current = fit;
  const pickedRef = useRef(picked);
  pickedRef.current = picked;

  // New data (another range): keep the source if it still exists, suggest
  // the rest afresh.
  useEffect(() => {
    setSel((s) => {
      const source = s[0] === 'all' || paths.some((p) => p.src === s[0]) ? s[0] : 'all';
      return extendCommon(paths, [source], fitRef.current - 1);
    });
    setPicked(1);
  }, [paths]);

  // Different width (window resized, sidebar toggled): keep what was clicked,
  // re-suggest only the rest so the visible columns stay filled.
  useEffect(() => {
    setSel((s) =>
      extendCommon(paths, s.slice(0, pickedRef.current), Math.max(fit - 1, pickedRef.current)),
    );
  }, [fit]); // eslint-disable-line react-hooks/exhaustive-deps -- paths: handled by the effect above

  const columns = useMemo(() => columnsFor(paths, sel), [paths, sel]);
  const first = Math.max(0, columns.length - fit);

  const pick = (col: number, key: string) => {
    const base = [...sel.slice(0, col), key];
    setSel(extendCommon(paths, base, Math.max(fit - 1, base.length)));
    setPicked(base.length);
  };
  const backTo = (k: number) => {
    const base = sel.slice(0, k + 1);
    setSel(extendCommon(paths, base, Math.max(fit - 1, base.length)));
    setPicked(base.length);
  };
  const load = (steps: string[]) => {
    setSel([sel[0], ...steps]);
    setPicked(steps.length + 1);
  };
  const reset = () => {
    setSel(extendCommon(paths, ['all'], fit - 1));
    setPicked(1);
  };

  // Visits on the selected node of each column (for the breadcrumb).
  const nodeCount = (k: number) =>
    columns[k]?.options.find((o) => pickable(o) && o.key === sel[k])?.n ?? 0;
  const total = columns[0]?.base ?? 0;
  const lastN = nodeCount(sel.length - 1);

  const convOptions = useMemo(() => conversionOptions(paths), [paths]);
  const current = convOptions.some((o) => o.value === outcome) ? outcome : 'all';
  const { rows, total: jTotal, single } = useMemo(
    () => topJourneys(paths, sel[0], current, 5, 10),
    [paths, sel, current],
  );
  const shownRows = showAll ? rows : rows.slice(0, 5);
  const selKey = sel.slice(1).join('\t');

  return (
    <Card title="Visitor paths" caption="where visits come from and where they go next" wide>
      {/* always rendered, so the width observer has something to measure */}
      <div ref={wrapRef}>
      {total === 0 ? (
        <div className="cfc-empty-line">No visits in this range.</div>
      ) : (
        <div>
          <div className="cfc-pe__crumbs" aria-label="Selected path">
            {sel.map((key, k) => (
              <React.Fragment key={k}>
                {k > 0 && <span className="cfc-pe__arrow">→</span>}
                <button
                  type="button"
                  className={`cfc-pe__chip${k >= picked ? ' is-suggested' : ''}`}
                  onClick={() => backTo(k)}
                  title="Go back to this step"
                >
                  {k === 0 ? sourceLabel(key) : stepLabel(key)}
                  <span className="cfc-pe__chipnum"> {fmtInt(nodeCount(k))}</span>
                </button>
              </React.Fragment>
            ))}
            <span className="cfc-pe__sum">
              = {fmtPct(total ? (lastN / total) * 100 : 0)} of all visits
            </span>
            {(picked > 1 || sel[0] !== 'all') && (
              <button type="button" className="cfc-linkbtn" onClick={reset}>
                Reset
              </button>
            )}
          </div>

          <div className="cfc-pe" style={{ gridTemplateColumns: `repeat(${fit}, minmax(0, 1fr))` }}>
            {columns.slice(first, first + fit).map((col, i) => {
              const k = first + i;
              return (
                <div className="cfc-pe__col" key={k}>
                  <div className="cfc-pe__head">
                    {k === 0 ? 'Source' : k === 1 ? 'Entry page' : `Step ${k}`}
                    {k > 1 && <span className="cfc-pe__after"> · after {stepLabel(sel[k - 1])}</span>}
                    {k === 1 && sel[0] !== 'all' && (
                      <span className="cfc-pe__after"> · from {sourceLabel(sel[0])}</span>
                    )}
                  </div>
                  {col.options.map((o) => (
                    <OptionCard
                      key={`${o.kind}|${o.key}`}
                      o={o}
                      selected={pickable(o) && sel[k] === o.key}
                      suggested={k >= picked}
                      onPick={() => pick(k, o.key)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          <p className="cfc-footnote">
            % = share of the visits on the selected card one column to the left. Dashed = suggested
            (the most common next step) – click any card to follow that branch instead.
            {first > 0 && ' Earlier steps are in the path above.'}
          </p>
        </div>
      )}
      </div>

      <div className="cfc-pe__common">
        <div className="cfc-flow__bar">
          <h3 className="cfc-pe__subtitle">
            Common paths
            {sel[0] !== 'all' && <span className="cfc-pe__after"> · from {sourceLabel(sel[0])}</span>}
          </h3>
          <label className="cfc-select">
            <select value={current} onChange={(e) => setOutcome(e.target.value)}>
              <option value="all">All visits</option>
              {convOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  Leading to ✓ {o.label} ({fmtInt(o.n)})
                </option>
              ))}
            </select>
          </label>
          <span className="cfc-flow__stats">
            {current === 'all'
              ? `${fmtPct(jTotal ? (single / jTotal) * 100 : 0)} of ${fmtInt(jTotal)} visits saw only one page (not listed).`
              : `${fmtInt(jTotal)} visits made it. Click a path to open it above.`}
          </span>
        </div>
        {shownRows.length === 0 ? (
          <div className="cfc-empty-line">No data in this range.</div>
        ) : (
          <ol className="cfc-pe__paths">
            {shownRows.map((j, idx) => {
              const loadable = !j.cut;
              const active = loadable && j.steps.join('\t') === selKey;
              const body = (
                <>
                  <span className="cfc-pe__rank">{idx + 1}</span>
                  <span className="cfc-journey">
                    {j.cut && <span className="cfc-journey__arrow">… →</span>}
                    {j.steps.map((s, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="cfc-journey__arrow">→</span>}
                        <span className={`cfc-journey__step${isConversion(s) ? ' is-conversion' : ''}`}>
                          {stepLabel(s)}
                        </span>
                      </React.Fragment>
                    ))}
                    {j.more && <span className="cfc-journey__arrow">→ …</span>}
                  </span>
                  <span className="cfc-bars__value">
                    {fmtInt(j.n)} · {fmtPct(jTotal ? (j.n / jTotal) * 100 : 0)}
                  </span>
                </>
              );
              return (
                <li key={`${j.cut}${j.steps.join('>')}${j.more}`}>
                  {loadable ? (
                    <button
                      type="button"
                      className={`cfc-pe__path${active ? ' is-active' : ''}`}
                      onClick={() => load(j.steps)}
                      title="Open this path in the explorer"
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="cfc-pe__path is-static">{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {rows.length > 5 && (
          <button type="button" className="cfc-linkbtn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show top 5' : `Show top ${rows.length}`}
          </button>
        )}
      </div>
      <p className="cfc-footnote">
        A visit is one browser tab – a refresh, new tab or later visit starts a new one, so paths
        across visits aren’t linked. Project and blog pages count as one page each.
      </p>
    </Card>
  );
}
