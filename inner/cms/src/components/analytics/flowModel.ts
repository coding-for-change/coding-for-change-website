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
  /** Share of the column's base (the visits at the previous selected node). */
  pct: number;
};

export type ExplorerColumn = { base: number; options: ExplorerOption[] };

/** Can this option be picked (followed further)? */
export const pickable = (o: ExplorerOption) =>
  o.kind === 'source' || o.kind === 'page' || o.kind === 'conversion';

const share = (n: number, base: number) => (base ? Math.round((n / base) * 1000) / 10 : 0);

const bySource = (paths: PathGroup[], source: string) =>
  source === 'all' ? paths : paths.filter((p) => p.src === source);

/** Column 0: every source, "All sources" first. */
export function sourceColumn(paths: PathGroup[]): ExplorerColumn {
  const totals = new Map<string, { ch: string; n: number }>();
  let base = 0;
  for (const p of paths) {
    base += p.n;
    const t = totals.get(p.src) ?? { ch: p.ch, n: 0 };
    t.n += p.n;
    totals.set(p.src, t);
  }
  const options: ExplorerOption[] = [...totals.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([src, t]) => ({ key: src, kind: 'source', label: sourceLabel(src, t.ch), n: t.n, pct: share(t.n, base) }));
  return { base, options: [{ key: 'all', kind: 'source', label: 'All sources', n: base, pct: 100 }, ...options] };
}

/**
 * Column k ≥ 1: what visits from `source` that took exactly `prefix` (the
 * steps picked so far) did next. Pages beyond the `keep` biggest fold into
 * "Other pages"; conversions are always listed; visits that ended there are
 * "Left the site".
 */
export function stepColumn(paths: PathGroup[], source: string, prefix: string[], keep = 7): ExplorerColumn {
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
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const pages = ranked.filter(([k]) => !isConversion(k) && k !== '(other page)');
  const shown = pages.length === keep + 1 ? pages : pages.slice(0, keep);
  const folded =
    pages.slice(shown.length).reduce((a, [, n]) => a + n, 0) + (counts.get('(other page)') ?? 0) + beyond;
  const options: ExplorerOption[] = [
    ...shown.map(([k, n]) => ({ key: k, kind: 'page' as const, label: k, n, pct: share(n, base) })),
    ...ranked
      .filter(([k]) => isConversion(k))
      .map(([k, n]) => ({ key: k, kind: 'conversion' as const, label: stepLabel(k), n, pct: share(n, base) })),
  ];
  if (folded) options.push({ key: '', kind: 'other', label: 'Other pages', n: folded, pct: share(folded, base) });
  if (exits) options.push({ key: '', kind: 'exit', label: 'Left the site', n: exits, pct: share(exits, base) });
  return { base, options };
}

/** All columns for a selection: one per picked element, plus the next one. */
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
  /** Earlier steps were dropped (only for paths leading to a conversion). */
  cut: boolean;
  /** The visit went on after the steps shown. */
  more: boolean;
  n: number;
};

/**
 * Most common paths of visits from `source`. For `all`: visits with at least
 * two steps, first `len` steps. For a conversion marker: visits that made that
 * conversion, cut at it – the path that led there (the last `len` steps, with
 * `cut` set when earlier steps were dropped).
 */
export function topJourneys(paths: PathGroup[], source: string, outcome: string, len = 5, limit = 10) {
  const groups = new Map<string, JourneyRow>();
  let total = 0;
  let single = 0;
  for (const p of bySource(paths, source)) {
    let steps: string[];
    let cut = false;
    let more = false;
    if (outcome === 'all') {
      total += p.n;
      if (p.steps.length < 2 && !p.more) {
        single += p.n;
        continue;
      }
      steps = p.steps.slice(0, len);
      more = p.more || p.steps.length > len;
    } else {
      const i = p.steps.indexOf(outcome);
      if (i < 0) continue;
      total += p.n;
      const from = Math.max(0, i + 1 - len);
      steps = p.steps.slice(from, i + 1);
      cut = from > 0;
    }
    const key = `${cut ? '…' : ''}${steps.join('\t')}${more ? '…' : ''}`;
    const row = groups.get(key) ?? { steps, cut, more, n: 0 };
    row.n += p.n;
    groups.set(key, row);
  }
  const rows = [...groups.values()].sort((a, b) => b.n - a.n).slice(0, limit);
  return { rows, total, single };
}
