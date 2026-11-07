import type { PathGroup } from '../../endpoints/analyticsFlow';

/**
 * Pure functions behind the path explorer and the common-paths list. Input is
 * the grouped visit paths from GET /api/analytics/flow (pages and `!…`
 * conversion markers in order, with a count). Everything is computed here, in
 * the browser – a new view on the same data needs no SQL.
 *
 * The explorer is a chain of columns: the source the visit came from, then its
 * entry page, then each next step. A selection is that chain as an array:
 * `[source, step1, step2, …]`, where source is `all` or one source.
 */

/* ---- labels ------------------------------------------------------------------ */

export const CONVERSION_LABELS: Record<string, string> = {
  membership: 'Membership application',
  speedrun: 'Speedrun application',
  techtour: 'Tech Tour registration',
  booking: 'Call booked',
  contact: 'Contact form',
  waitlist: 'Waitlist signup',
};

/** Fixed order for conversion types in menus. */
const CONVERSION_ORDER = ['membership', 'techtour', 'speedrun', 'booking', 'contact', 'waitlist'];

export const isConversion = (step: string) => step.startsWith('!');

/** Human label for a step: the page path, or "✓ Membership application". */
export function stepLabel(step: string): string {
  if (!isConversion(step)) return step === '(other page)' ? 'Other pages' : step;
  const key = step.slice(1);
  const name = key.startsWith('form:') ? `Form “${key.slice(5)}”` : (CONVERSION_LABELS[key] ?? key);
  return `✓ ${name}`;
}

export const CHANNEL_TAGS: Record<string, string> = {
  campaign: 'tagged',
  organic_search: 'search',
  social: 'social',
  referral: 'referral',
};

export function sourceLabel(src: string, ch?: string): string {
  if (src === 'all') return 'All sources';
  if (src === '(direct)') return 'Direct / unknown';
  if (src === '(other source)') return 'Other sources';
  const tag = ch ? CHANNEL_TAGS[ch] : '';
  return tag ? `${src} · ${tag}` : src;
}

/* ---- explorer columns ------------------------------------------------------------ */

export type OptionKind = 'source' | 'page' | 'conversion' | 'exit' | 'other';

export type ExplorerOption = {
  /** What goes into the selection when picked (empty for exit / other). */
  key: string;
  kind: OptionKind;
  label: string;
  n: number;
  /** Share of the column's base (the visits on the selected card next to it). */
  pct: number;
  /** Small: listed only once the column is expanded ("+ N more"). */
  minor?: boolean;
};

export type ExplorerColumn = { base: number; options: ExplorerOption[] };

/** Can this option be picked (followed further)? */
export const pickable = (o: ExplorerOption) =>
  o.kind === 'source' || o.kind === 'page' || o.kind === 'conversion';

const share = (n: number, base: number) => (base ? Math.round((n / base) * 1000) / 10 : 0);

/** At most this many options per column before "+ N more"… */
const MAIN_OPTIONS = 6;
/** …and none below this share (%). Conversions are always shown. */
const MINOR_PCT = 1;

/** An outside source as a step in a chain (backwards it is where a visit began). */
export const sourceKey = (src: string, ch: string) => `@${src}|${ch}`;
export const isSourceKey = (k: string) => k.startsWith('@');
const parseSourceKey = (k: string) => {
  const [src, ch] = k.slice(1).split('|');
  return { src, ch };
};

/** Label of any chain key: page path, ✓ conversion, or "via <source>" (where the visit began). */
export function keyLabel(key: string): string {
  if (isSourceKey(key)) {
    const { src, ch } = parseSourceKey(key);
    if (src === '(direct)') return 'Direct entry';
    if (src === '(other source)') return 'via other sources';
    return `via ${sourceLabel(src, ch)}`;
  }
  return stepLabel(key);
}

const kindOf = (k: string): OptionKind =>
  isSourceKey(k) ? 'source' : isConversion(k) ? 'conversion' : 'page';

/**
 * Raw counts → a column: the biggest options first, small ones flagged
 * `minor`, conversions always listed, then the static rows ("Other pages",
 * "Left the site").
 */
function toColumn(
  counts: Map<string, number>,
  base: number,
  label: (k: string) => string,
  kind: (k: string) => OptionKind,
  statics: { other?: number; exits?: number } = {},
): ExplorerColumn {
  const main: ExplorerOption[] = [];
  const minor: ExplorerOption[] = [];
  const conv: ExplorerOption[] = [];
  for (const [k, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    if (k === '(other page)') continue;
    const o: ExplorerOption = { key: k, kind: kind(k), label: label(k), n, pct: share(n, base) };
    if (o.kind === 'conversion') conv.push(o);
    else if (main.length < MAIN_OPTIONS && o.pct >= MINOR_PCT) main.push(o);
    else minor.push({ ...o, minor: true });
  }
  // Hiding a single option saves nothing.
  if (minor.length === 1) main.push({ ...minor.pop()!, minor: false });
  const options = [...main, ...minor, ...conv];
  const other = (statics.other ?? 0) + (counts.get('(other page)') ?? 0);
  if (other) options.push({ key: '', kind: 'other', label: 'Other pages', n: other, pct: share(other, base) });
  if (statics.exits) {
    options.push({ key: '', kind: 'exit', label: 'Left the site', n: statics.exits, pct: share(statics.exits, base) });
  }
  return { base, options };
}

const bySource = (paths: PathGroup[], source: string) =>
  source === 'all' ? paths : paths.filter((p) => p.src === source);

/* ---- forward: from the source on ---------------------------------------------- */

/** Column 0 of the forward view: every source, "All sources" first. */
export function sourceColumn(paths: PathGroup[]): ExplorerColumn {
  const counts = new Map<string, number>();
  const channel = new Map<string, string>();
  let base = 0;
  for (const p of paths) {
    base += p.n;
    counts.set(p.src, (counts.get(p.src) ?? 0) + p.n);
    channel.set(p.src, p.ch);
  }
  const col = toColumn(counts, base, (src) => sourceLabel(src, channel.get(src)), () => 'source');
  return {
    base,
    options: [{ key: 'all', kind: 'source', label: 'All sources', n: base, pct: 100 }, ...col.options],
  };
}

/**
 * Forward column k ≥ 1: what visits from `source` that took exactly `prefix`
 * (the steps picked so far) did next.
 */
export function stepColumn(paths: PathGroup[], source: string, prefix: string[]): ExplorerColumn {
  const counts = new Map<string, number>();
  let base = 0;
  let exits = 0;
  let beyond = 0; // went on past the steps we keep per visit
  outer: for (const p of bySource(paths, source)) {
    for (let i = 0; i < prefix.length; i++) if (p.steps[i] !== prefix[i]) continue outer;
    base += p.n;
    const next = p.steps[prefix.length];
    if (next === undefined) {
      if (p.more) beyond += p.n;
      else exits += p.n;
    } else counts.set(next, (counts.get(next) ?? 0) + p.n);
  }
  return toColumn(counts, base, stepLabel, kindOf, { other: beyond, exits });
}

/** All forward columns for a selection: one per picked element, plus the next one. */
export function columnsFor(paths: PathGroup[], sel: string[]): ExplorerColumn[] {
  const cols = [sourceColumn(paths)];
  for (let k = 1; k <= sel.length; k++) cols.push(stepColumn(paths, sel[0], sel.slice(1, k)));
  return cols;
}

/**
 * Extend a selection with the most common next page, step by step, until it
 * has `length` elements or no page follows. That's the "suggested" path the
 * explorer shows before (and after) every click.
 */
export function extendCommon(paths: PathGroup[], sel: string[], length: number): string[] {
  const out = sel.length ? [...sel] : ['all'];
  // A path that reached a conversion is the story; don't suggest past it.
  while (out.length < length && !isConversion(out[out.length - 1])) {
    const top = stepColumn(paths, out[0], out.slice(1)).options.find((o) => o.kind === 'page');
    if (!top) break;
    out.push(top.key);
  }
  return out;
}

/* ---- focus: around one fixed point ------------------------------------------------ */

/** Focus target for "the visit ended here". */
export const EXIT = '#exit';

type Anchor = { p: PathGroup; k: number };

/**
 * Visits that reached the target, with the target's position: its first
 * occurrence for a page or conversion, the end of the visit for EXIT (visits
 * longer than we keep are skipped there – their end is unknown).
 */
function anchors(paths: PathGroup[], target: string): Anchor[] {
  const out: Anchor[] = [];
  for (const p of paths) {
    if (target === EXIT) {
      if (!p.more) out.push({ p, k: p.steps.length });
      continue;
    }
    const k = p.steps.indexOf(target);
    if (k >= 0) out.push({ p, k });
  }
  return out;
}

export function focusTotal(paths: PathGroup[], target: string): number {
  return anchors(paths, target).reduce((a, x) => a + x.p.n, 0);
}

/** What came j steps before the anchor (0 = right before): a step, the source, or nothing. */
const before = (a: Anchor, j: number): string | undefined => {
  const i = a.k - 1 - j;
  if (i >= 0) return a.p.steps[i];
  return i === -1 ? sourceKey(a.p.src, a.p.ch) : undefined;
};

/**
 * Backward column: for visits that reached the target via exactly `back`
 * (picked so far, nearest first), what came right before that. Going back far
 * enough ends at the source ("Entered from …").
 */
export function backColumn(paths: PathGroup[], target: string, back: string[]): ExplorerColumn {
  const counts = new Map<string, number>();
  let base = 0;
  outer: for (const a of anchors(paths, target)) {
    for (let j = 0; j < back.length; j++) if (before(a, j) !== back[j]) continue outer;
    const prev = before(a, back.length);
    if (prev === undefined) continue;
    base += a.p.n;
    counts.set(prev, (counts.get(prev) ?? 0) + a.p.n);
  }
  return toColumn(counts, base, keyLabel, kindOf);
}

/** Forward column from the target: what came after it via exactly `fwd`. */
export function fwdColumn(paths: PathGroup[], target: string, fwd: string[]): ExplorerColumn {
  const counts = new Map<string, number>();
  let base = 0;
  let exits = 0;
  let beyond = 0;
  outer: for (const a of anchors(paths, target)) {
    for (let j = 0; j < fwd.length; j++) if (a.p.steps[a.k + 1 + j] !== fwd[j]) continue outer;
    base += a.p.n;
    const next = a.p.steps[a.k + 1 + fwd.length];
    if (next === undefined) {
      if (a.p.more) beyond += a.p.n;
      else exits += a.p.n;
    } else counts.set(next, (counts.get(next) ?? 0) + a.p.n);
  }
  return toColumn(counts, base, stepLabel, kindOf, { other: beyond, exits });
}

/** Suggested backward chain: the most common previous step, until the source. */
export function extendBack(paths: PathGroup[], target: string, back: string[], length: number): string[] {
  const out = [...back];
  while (out.length < length && !(out.length && isSourceKey(out[out.length - 1]))) {
    const top = backColumn(paths, target, out).options.find((o) => pickable(o) && !o.minor);
    if (!top) break;
    out.push(top.key);
  }
  return out;
}

/** Suggested forward chain from the target: the most common next page. */
export function extendFwd(paths: PathGroup[], target: string, fwd: string[], length: number): string[] {
  const out = [...fwd];
  while (out.length < length && !(out.length && isConversion(out[out.length - 1]))) {
    const top = fwdColumn(paths, target, out).options.find((o) => o.kind === 'page');
    if (!top) break;
    out.push(top.key);
  }
  return out;
}

/** What can be focused: pages, conversions, and the end of a visit. */
export function focusTargets(paths: PathGroup[]) {
  const pages = new Map<string, number>();
  for (const p of paths) {
    for (const step of new Set(p.steps)) {
      if (!isConversion(step) && step !== '(other page)') pages.set(step, (pages.get(step) ?? 0) + p.n);
    }
  }
  return {
    pages: [...pages.entries()].sort((a, b) => b[1] - a[1]).map(([value, n]) => ({ value, n })),
    exits: focusTotal(paths, EXIT),
  };
}

/** Conversion types present in the data, for the common-paths menu. */
export function conversionOptions(paths: PathGroup[]) {
  const counts = new Map<string, number>();
  for (const p of paths) {
    for (const step of new Set(p.steps)) if (isConversion(step)) counts.set(step, (counts.get(step) ?? 0) + p.n);
  }
  const rank = (key: string) => {
    const i = CONVERSION_ORDER.indexOf(key.slice(1));
    return i < 0 ? 99 : i;
  };
  return [...counts.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1])
    .map(([step, n]) => ({ value: step, label: stepLabel(step).slice(2), n }));
}

/* ---- common paths ------------------------------------------------------------------ */

export type JourneyRow = {
  steps: string[];
  /** Earlier steps were dropped. */
  cut: boolean;
  /** The visit went on after the steps shown. */
  more: boolean;
  n: number;
};

/** Station filter for common paths: a page count (6 = six or more), or 'any'. */
export type Stations = 'any' | 1 | 2 | 3 | 4 | 5 | 6;
export const MAX_STATIONS = 6;

const pageCount = (steps: string[]) => steps.filter((s) => !isConversion(s)).length;

/** The steps up to and including the k-th page (conversions in between kept). */
function firstPages(steps: string[], k: number): string[] {
  let pages = 0;
  for (let i = 0; i < steps.length; i++) {
    if (!isConversion(steps[i]) && ++pages === k) return steps.slice(0, i + 1);
  }
  return steps;
}

/** The steps from the k-th last page to the end. */
function lastPages(steps: string[], k: number): string[] {
  let pages = 0;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (!isConversion(steps[i]) && ++pages === k) return steps.slice(i);
  }
  return steps;
}

/**
 * Most common paths of visits from `source`.
 *
 *  - outcome `all`: the whole visit; outcome `!x`: the visit up to that
 *    conversion (the path that led there).
 *  - stations: only paths with exactly that many pages – conversions show in
 *    the path but don't count – so "3" lists the standard three-page routes;
 *    6 means six or more (shown as the first six pages, or the last six
 *    before a conversion). `any` = every length (first / last five steps).
 *
 * `byLength[n]` counts the visits with n pages (6 = six or more), for the
 * station buttons.
 */
export function topJourneys(
  paths: PathGroup[],
  source: string,
  outcome: string,
  stations: Stations = 'any',
  limit = 10,
) {
  const groups = new Map<string, JourneyRow>();
  const byLength = Array<number>(MAX_STATIONS + 1).fill(0);
  let total = 0;
  for (const p of bySource(paths, source)) {
    let path: string[];
    let truncated: boolean;
    if (outcome === 'all') {
      path = p.steps;
      truncated = p.more;
    } else {
      const i = p.steps.indexOf(outcome);
      if (i < 0) continue;
      path = p.steps.slice(0, i + 1);
      truncated = false;
    }
    total += p.n;
    const pages = pageCount(path);
    const bucket = truncated || pages >= MAX_STATIONS ? MAX_STATIONS : pages;
    if (bucket >= 1) byLength[bucket] += p.n;

    let steps: string[];
    let cut = false;
    let more = false;
    if (stations === 'any') {
      if (outcome === 'all') {
        if (path.length < 2 && !truncated) continue;
        steps = path.slice(0, 5);
        more = truncated || path.length > 5;
      } else {
        const from = Math.max(0, path.length - 5);
        steps = path.slice(from);
        cut = from > 0;
      }
    } else {
      if (bucket !== stations) continue;
      if (stations < MAX_STATIONS) steps = path;
      else if (outcome === 'all') {
        steps = firstPages(path, MAX_STATIONS);
        more = truncated || steps.length < path.length;
      } else {
        steps = lastPages(path, MAX_STATIONS);
        cut = steps.length < path.length;
      }
    }
    const key = `${cut ? '…' : ''}${steps.join('\t')}${more ? '…' : ''}`;
    const row = groups.get(key) ?? { steps, cut, more, n: 0 };
    row.n += p.n;
    groups.set(key, row);
  }
  const rows = [...groups.values()].sort((a, b) => b.n - a.n).slice(0, limit);
  return { rows, total, byLength };
}
