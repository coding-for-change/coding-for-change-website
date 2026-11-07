'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalyticsFlow } from '../../endpoints/analyticsFlow';
import {
  EXIT,
  type ExplorerColumn,
  type ExplorerOption,
  backColumn,
  columnsFor,
  conversionOptions,
  extendBack,
  extendCommon,
  extendFwd,
  focusTargets,
  focusTotal,
  fwdColumn,
  isConversion,
  isSourceKey,
  keyLabel,
  pickable,
  sourceLabel,
  stepLabel,
  topJourneys,
} from './flowModel';
import { Card, fmtInt } from './parts';

/**
 * "Visitor paths" on /admin/analytics: a path explorer plus the most common
 * paths, both from GET /api/analytics/flow. Two views on the same columns:
 *
 *  - From source: source → entry page → step 2 → …, each column what the
 *    visits selected so far did next.
 *  - Focus: one fixed point (a page, a conversion, or "Left the site") in the
 *    middle; to its left, step by step, what came before it back to the
 *    source; to its right, what came after.
 *
 * In both, the most common continuation is pre-selected and marked
 * "suggested"; a click on a card follows that branch, the crosshair on a card
 * focuses it. Each view keeps its own selection, so switching back and forth
 * loses nothing. Small options sit behind "+ N more".
 */

const fmtPct = (p: number) => `${p < 10 ? p.toFixed(1) : Math.round(p)}%`;

const BAR: Record<ExplorerOption['kind'], string> = {
  source: 'var(--cfc-other)',
  page: 'var(--cfc-s1)',
  conversion: 'var(--cfc-s3)',
  other: 'var(--cfc-muted)',
  exit: 'var(--cfc-axis)',
};

type Mode = 'forward' | 'focus';

function useColumnsThatFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setFit(Math.min(5, Math.max(3, Math.floor(e.contentRect.width / 230)))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, fit] as const;
}

function CrosshairIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 0.5v3.5M8 12v3.5M0.5 8h3.5M12 8h3.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function OptionCard({
  o,
  selected,
  suggested,
  onPick,
  onFocus,
}: {
  o: ExplorerOption;
  selected: boolean;
  suggested: boolean;
  onPick?: () => void;
  onFocus?: () => void;
}) {
  const body = (
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
  const cls = `cfc-pe__card${selected ? (suggested ? ' is-suggested' : ' is-selected') : ''}${onPick ? '' : ' is-static'}${onFocus ? ' has-focus' : ''}`;
  return (
    <div className="cfc-pe__cardwrap">
      {onPick ? (
        <button type="button" className={cls} aria-pressed={selected} onClick={onPick}>
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
      {onFocus && (
        <button
          type="button"
          className="cfc-pe__focusbtn"
          onClick={onFocus}
          title={`Focus on “${o.label}”: where visits came from and where they went`}
          aria-label={`Focus on ${o.label}`}
        >
          <CrosshairIcon />
        </button>
      )}
    </div>
  );
}

/** One explorer column with its small options folded behind "+ N more". */
function Column({
  head,
  sub,
  col,
  selectedKey,
  suggested,
  expanded,
  onExpand,
  onPick,
  onFocus,
}: {
  head: string;
  sub?: string;
  col: ExplorerColumn;
  selectedKey: string | undefined;
  suggested: boolean;
  expanded: boolean;
  onExpand: (open: boolean) => void;
  onPick?: (o: ExplorerOption) => void;
  onFocus: (o: ExplorerOption) => ((() => void) | undefined);
}) {
  const minor = col.options.filter((o) => o.minor);
  const minorPct = minor.reduce((a, o) => a + o.pct, 0);
  const rows: React.ReactNode[] = [];
  let expanderDone = false;
  for (const o of col.options) {
    const isSel = pickable(o) && o.key === selectedKey;
    if (o.minor && !expanded && !isSel) {
      if (!expanderDone) {
        expanderDone = true;
        rows.push(
          <button key="more" type="button" className="cfc-pe__more" onClick={() => onExpand(true)}>
            + {minor.length} more · {fmtPct(minorPct)}
          </button>,
        );
      }
      continue;
    }
    rows.push(
      <OptionCard
        key={`${o.kind}|${o.key}|${o.label}`}
        o={o}
        selected={isSel}
        suggested={suggested}
        onPick={onPick && pickable(o) ? () => onPick(o) : undefined}
        onFocus={onFocus(o)}
      />,
    );
    if (o.minor && expanded && o === minor[minor.length - 1]) {
      rows.push(
        <button key="less" type="button" className="cfc-pe__more" onClick={() => onExpand(false)}>
          Show fewer
        </button>,
      );
    }
  }
  return (
    <div className="cfc-pe__col">
      <div className="cfc-pe__head">
        {head}
        {sub && <span className="cfc-pe__after"> · {sub}</span>}
      </div>
      {rows}
    </div>
  );
}

type Focus = { target: string; back: string[]; backPicked: number; fwd: string[]; fwdPicked: number; lo: number };

export function PathsCard({ flow }: { flow: AnalyticsFlow }) {
  const [wrapRef, fit] = useColumnsThatFit();
  const paths = flow.paths;
  const [mode, setMode] = useState<Mode>('forward');
  // Forward selection = [source, step1, step2, …]; the first `picked` were
  // clicked, the rest are the suggested continuation.
  const [sel, setSel] = useState<string[]>(['all']);
  const [picked, setPicked] = useState(1);
  const [focus, setFocusState] = useState<Focus | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [outcome, setOutcome] = useState('all');
  const [showAll, setShowAll] = useState(false);

  // Refs so the effects below read the latest values without re-running on them.
  const fitRef = useRef(fit);
  fitRef.current = fit;
  const pickedRef = useRef(picked);
  pickedRef.current = picked;

  const convOptions = useMemo(() => conversionOptions(paths), [paths]);
  const targets = useMemo(() => focusTargets(paths), [paths]);

  /** Focus state for a target, with the default window and suggestions. */
  const focusOn = (target: string, f = fit): Focus => {
    const hasFwd = target !== EXIT;
    const backCols = !hasFwd ? f - 1 : isConversion(target) ? f - 2 : Math.floor((f - 1) / 2);
    const fwdCols = f - 1 - backCols;
    return {
      target,
      back: extendBack(paths, target, [], backCols),
      backPicked: 0,
      fwd: hasFwd ? extendFwd(paths, target, [], fwdCols) : [],
      fwdPicked: 0,
      lo: -backCols,
    };
  };

  // New data (another range): keep the source / focus target if they still
  // exist, suggest the rest afresh.
  useEffect(() => {
    setSel((s) => {
      const source = s[0] === 'all' || paths.some((p) => p.src === s[0]) ? s[0] : 'all';
      return extendCommon(paths, [source], fitRef.current - 1);
    });
    setPicked(1);
    setFocusState((f) => (f && focusTotal(paths, f.target) > 0 ? focusOn(f.target, fitRef.current) : null));
    setExpanded(new Set());
  }, [paths]); // eslint-disable-line react-hooks/exhaustive-deps -- focusOn reads paths

  // Different width (window resized, sidebar toggled): keep what was clicked,
  // re-suggest only the rest so the visible columns stay filled.
  useEffect(() => {
    setSel((s) =>
      extendCommon(paths, s.slice(0, pickedRef.current), Math.max(fit - 1, pickedRef.current)),
    );
    setFocusState((f) => (f && f.backPicked === 0 && f.fwdPicked === 0 ? focusOn(f.target, fit) : f));
  }, [fit]); // eslint-disable-line react-hooks/exhaustive-deps -- paths: handled by the effect above

  const startFocus = (target: string) => {
    setFocusState(focusOn(target));
    setExpanded(new Set());
    setMode('focus');
  };
  const focusHandler = (o: ExplorerOption) =>
    o.kind === 'page' || o.kind === 'conversion'
      ? () => startFocus(o.key)
      : o.kind === 'exit'
        ? () => startFocus(EXIT)
        : undefined;
  const toggleExpanded = (id: string, open: boolean) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  /* ---- forward view --------------------------------------------------------- */

  const fCols = useMemo(() => columnsFor(paths, sel), [paths, sel]);
  const fFirst = Math.max(0, fCols.length - fit);
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
    setMode('forward');
  };
  const resetForward = () => {
    setSel(extendCommon(paths, ['all'], fit - 1));
    setPicked(1);
  };
  const fCount = (k: number) => fCols[k]?.options.find((o) => pickable(o) && o.key === sel[k])?.n ?? 0;
  const total = fCols[0]?.base ?? 0;

  /* ---- focus view ----------------------------------------------------------- */

  const focusView = useMemo(() => {
    if (!focus) return null;
    const { target, back, fwd } = focus;
    const backCols: ExplorerColumn[] = [];
    for (let j = 0; j <= back.length; j++) {
      if (j > 0 && isSourceKey(back[j - 1])) break;
      backCols.push(backColumn(paths, target, back.slice(0, j)));
    }
    const fwdCols: ExplorerColumn[] = [];
    if (target !== EXIT) for (let j = 0; j <= fwd.length; j++) fwdCols.push(fwdColumn(paths, target, fwd.slice(0, j)));
    const B = backCols.length;
    const F = fwdCols.length;
    let lo = Math.max(focus.lo, -B);
    let hi = lo + fit - 1;
    if (hi > F) {
      hi = F;
      lo = Math.max(-B, hi - fit + 1);
    }
    return { backCols, fwdCols, lo, hi, n: focusTotal(paths, target) };
  }, [paths, focus, fit]);

  const pickBack = (j: number, key: string) => {
    if (!focus) return;
    const base = [...focus.back.slice(0, j), key];
    const reveal = -(j + 2); // the column the click opens, left of this one
    const lo = isSourceKey(key) ? focus.lo : Math.min(focus.lo, reveal);
    setFocusState({ ...focus, back: extendBack(paths, focus.target, base, Math.max(base.length, -lo)), backPicked: base.length, lo });
  };
  const pickFwd = (j: number, key: string) => {
    if (!focus) return;
    const base = [...focus.fwd.slice(0, j), key];
    const reveal = j + 2;
    const lo = Math.max(focus.lo, reveal - fit + 1);
    setFocusState({ ...focus, fwd: extendFwd(paths, focus.target, base, Math.max(base.length, lo + fit - 1)), fwdPicked: base.length, lo });
  };
  const backToFocus = (side: 'back' | 'fwd', j: number) => {
    if (!focus) return;
    if (side === 'back') {
      const base = focus.back.slice(0, j + 1);
      setFocusState({ ...focus, back: extendBack(paths, focus.target, base, Math.max(base.length, -focus.lo)), backPicked: base.length });
    } else {
      const base = focus.fwd.slice(0, j + 1);
      setFocusState({ ...focus, fwd: extendFwd(paths, focus.target, base, Math.max(base.length, focus.lo + fit - 1)), fwdPicked: base.length });
    }
  };

  const focusLabel = (t: string) => (t === EXIT ? 'Left the site' : keyLabel(t));
  const backHead = (j: number, target: string) =>
    target === EXIT && j === 0 ? 'Last page' : j === 0 ? 'Step before' : `${j + 1} steps before`;
  const fwdHead = (j: number) => (j === 0 ? 'Next step' : `${j + 1} steps after`);

  /* ---- common paths ------------------------------------------------------- */

  const current = convOptions.some((o) => o.value === outcome) ? outcome : 'all';
  const { rows, total: jTotal, single } = useMemo(
    () => topJourneys(paths, sel[0], current, 5, 10),
    [paths, sel, current],
  );
  const shownRows = showAll ? rows : rows.slice(0, 5);
  const selKey = mode === 'forward' ? sel.slice(1).join('\t') : '';

  const defaultTarget = convOptions[0]?.value ?? EXIT;

  return (
    <Card title="Visitor paths" caption="where visits come from and where they go next" wide>
      <div ref={wrapRef}>
        <div className="cfc-flow__bar">
          <div className="cfc-range cfc-range--small" role="group" aria-label="Explorer view">
            <button
              type="button"
              className={`cfc-range__btn ${mode === 'forward' ? 'is-active' : ''}`}
              aria-pressed={mode === 'forward'}
              onClick={() => setMode('forward')}
            >
              From source
            </button>
            <button
              type="button"
              className={`cfc-range__btn ${mode === 'focus' ? 'is-active' : ''}`}
              aria-pressed={mode === 'focus'}
              onClick={() => (focus ? setMode('focus') : startFocus(defaultTarget))}
            >
              Focus on a step
            </button>
          </div>
          {mode === 'focus' && focus && (
            <label className="cfc-select">
              <span className="cfc-select__label">Focus</span>
              <select value={focus.target} onChange={(e) => startFocus(e.target.value)}>
                <optgroup label="Conversions">
                  {convOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      ✓ {o.label} ({fmtInt(o.n)})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="End of the visit">
                  <option value={EXIT}>Left the site ({fmtInt(targets.exits)})</option>
                </optgroup>
                <optgroup label="Pages">
                  {targets.pages.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.value} ({fmtInt(o.n)})
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          )}
          <span className="cfc-flow__stats">
            {mode === 'forward'
              ? 'Pick a source, then follow the visits step by step.'
              : focus?.target === EXIT
                ? 'Where visits ended, and what led there – read from the right to the left.'
                : 'Before this step on the left (back to where the visit came from), after it on the right.'}
          </span>
        </div>

        {total === 0 ? (
          <div className="cfc-empty-line">No visits in this range.</div>
        ) : mode === 'forward' ? (
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
                    <span className="cfc-pe__chipnum"> {fmtInt(fCount(k))}</span>
                  </button>
                </React.Fragment>
              ))}
              <span className="cfc-pe__sum">
                = {fmtPct(total ? (fCount(sel.length - 1) / total) * 100 : 0)} of all visits
              </span>
              {(picked > 1 || sel[0] !== 'all') && (
                <button type="button" className="cfc-linkbtn" onClick={resetForward}>
                  Reset
                </button>
              )}
            </div>
            <div className="cfc-pe" style={{ gridTemplateColumns: `repeat(${fit}, minmax(0, 1fr))` }}>
              {fCols.slice(fFirst, fFirst + fit).map((col, i) => {
                const k = fFirst + i;
                const id = `f${k}`;
                return (
                  <Column
                    key={id}
                    head={k === 0 ? 'Source' : k === 1 ? 'Entry page' : `Step ${k}`}
                    sub={
                      k > 1
                        ? `after ${stepLabel(sel[k - 1])}`
                        : k === 1 && sel[0] !== 'all'
                          ? `from ${sourceLabel(sel[0])}`
                          : undefined
                    }
                    col={col}
                    selectedKey={sel[k]}
                    suggested={k >= picked}
                    expanded={expanded.has(id)}
                    onExpand={(open) => toggleExpanded(id, open)}
                    onPick={(o) => pick(k, o.key)}
                    onFocus={focusHandler}
                  />
                );
              })}
            </div>
          </div>
        ) : focus && focusView ? (
          <div>
            <div className="cfc-pe__crumbs" aria-label="Path around the focus">
              {[...focus.back].reverse().map((key, i) => {
                const j = focus.back.length - 1 - i;
                return (
                  <React.Fragment key={`b${j}`}>
                    <button
                      type="button"
                      className={`cfc-pe__chip${j >= focus.backPicked ? ' is-suggested' : ''}`}
                      onClick={() => backToFocus('back', j)}
                      title="Go back to this step"
                    >
                      {keyLabel(key)}
                    </button>
                    <span className="cfc-pe__arrow">→</span>
                  </React.Fragment>
                );
              })}
              <span className="cfc-pe__chip is-focus">
                {focusLabel(focus.target)}
                <span className="cfc-pe__chipnum"> {fmtInt(focusView.n)}</span>
              </span>
              {focus.fwd.map((key, j) => (
                <React.Fragment key={`f${j}`}>
                  <span className="cfc-pe__arrow">→</span>
                  <button
                    type="button"
                    className={`cfc-pe__chip${j >= focus.fwdPicked ? ' is-suggested' : ''}`}
                    onClick={() => backToFocus('fwd', j)}
                    title="Go back to this step"
                  >
                    {stepLabel(key)}
                  </button>
                </React.Fragment>
              ))}
              {(focus.backPicked > 0 || focus.fwdPicked > 0) && (
                <button type="button" className="cfc-linkbtn" onClick={() => setFocusState(focusOn(focus.target))}>
                  Reset
                </button>
              )}
            </div>
            <div className="cfc-pe" style={{ gridTemplateColumns: `repeat(${fit}, minmax(0, 1fr))` }}>
              {Array.from({ length: focusView.hi - focusView.lo + 1 }, (_, i) => focusView.lo + i).map((p) => {
                if (p === 0) {
                  return (
                    <div className="cfc-pe__col" key="focus">
                      <div className="cfc-pe__head">Focus</div>
                      <div className="cfc-pe__focuscard">
                        <span className={`cfc-pe__label cfc-pe__label--${focus.target === EXIT ? 'exit' : isConversion(focus.target) ? 'conversion' : 'page'}`}>
                          {focusLabel(focus.target)}
                        </span>
                        <span className="cfc-pe__focusnum">{fmtInt(focusView.n)} visits</span>
                        <span className="cfc-pe__hint">
                          {focus.target === EXIT
                            ? 'every visit ends somewhere – the columns show where, and what led there'
                            : `${fmtPct(total ? (focusView.n / total) * 100 : 0)} of all visits`}
                        </span>
                      </div>
                    </div>
                  );
                }
                if (p < 0) {
                  const j = -p - 1;
                  const id = `b${j}`;
                  return (
                    <Column
                      key={id}
                      head={backHead(j, focus.target)}
                      sub={j > 0 ? `before ${keyLabel(focus.back[j - 1])}` : undefined}
                      col={focusView.backCols[j]}
                      selectedKey={focus.back[j]}
                      suggested={j >= focus.backPicked}
                      expanded={expanded.has(id)}
                      onExpand={(open) => toggleExpanded(id, open)}
                      onPick={(o) => pickBack(j, o.key)}
                      onFocus={focusHandler}
                    />
                  );
                }
                const j = p - 1;
                const id = `a${j}`;
                return (
                  <Column
                    key={id}
                    head={fwdHead(j)}
                    sub={j > 0 ? `after ${stepLabel(focus.fwd[j - 1])}` : undefined}
                    col={focusView.fwdCols[j]}
                    selectedKey={focus.fwd[j]}
                    suggested={j >= focus.fwdPicked}
                    expanded={expanded.has(id)}
                    onExpand={(open) => toggleExpanded(id, open)}
                    onPick={(o) => pickFwd(j, o.key)}
                    onFocus={focusHandler}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
        {total > 0 && (
          <p className="cfc-footnote">
            % = share of the visits on the selected card next to it
            {mode === 'focus' ? ' (to its right for the steps before, to its left for the steps after)' : ' (one column to the left)'}
            . Dashed = suggested, the most common step – click any card to follow that branch
            instead, or its <CrosshairIcon /> to focus on it.
          </p>
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
