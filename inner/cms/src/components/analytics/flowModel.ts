import type { PathGroup } from '../../endpoints/analyticsFlow';

/**
 * Pure functions behind the visitor-flow diagram and the journey list. Input
 * is the grouped visit paths from GET /api/analytics/flow (pages and `!…`
 * conversion markers in order, with a count); output is what the cards draw.
 * Everything a filter can do happens here, in the browser – adding a filter
 * means touching `FlowFilter` and `matches`, not the SQL.
 */

/* ---- steps ------------------------------------------------------------------ */

export const CONVERSION_LABELS: Record<string, string> = {
  membership: 'Membership application',
  speedrun: 'Speedrun application',
  techtour: 'Tech Tour registration',
  booking: 'Call booked',
  contact: 'Contact form',
  waitlist: 'Waitlist signup',
};

/** Fixed order for conversion types in menus and legends. */
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
  if (src === '(direct)') return 'Direct / unknown';
  if (src === '(other source)') return 'Other sources';
  const tag = ch ? CHANNEL_TAGS[ch] : '';
  return tag ? `${src} · ${tag}` : src;
}

/* ---- filters ------------------------------------------------------------------ */

/** `all`, `converted`, `none`, or one conversion marker such as `!membership`. */
export type Outcome = string;

export type FlowFilter = {
  /** `all` or one source. */
  source: string;
  /** `entry` (the visit's first page) or a page path to start from. */
  start: string;
  outcome: Outcome;
  /** Steps shown after the start. */
  depth: number;
};

export const DEFAULT_FILTER: FlowFilter = { source: 'all', start: 'entry', outcome: 'all', depth: 5 };

export function matches(p: PathGroup, f: Pick<FlowFilter, 'source' | 'outcome'>): boolean {
  if (f.source !== 'all' && p.src !== f.source) return false;
  if (f.outcome === 'all') return true;
  const converted = p.steps.some(isConversion);
  if (f.outcome === 'converted') return converted;
  if (f.outcome === 'none') return !converted;
  return p.steps.includes(f.outcome);
}

/** Options for the filter menus, with visit counts, most visits first. */
export function filterOptions(paths: PathGroup[]) {
  const sources = new Map<string, { ch: string; n: number }>();
  const pages = new Map<string, number>();
  const conversions = new Map<string, number>();
  for (const p of paths) {
    const s = sources.get(p.src) ?? { ch: p.ch, n: 0 };
    s.n += p.n;
    sources.set(p.src, s);
    for (const step of new Set(p.steps)) {
      const bucket = isConversion(step) ? conversions : pages;
      bucket.set(step, (bucket.get(step) ?? 0) + p.n);
    }
  }
  const rank = (key: string) => {
    const i = CONVERSION_ORDER.indexOf(key.slice(1));
    return i < 0 ? 99 : i;
  };
  return {
    sources: [...sources.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .map(([src, v]) => ({ value: src, label: sourceLabel(src, v.ch), n: v.n })),
    pages: [...pages.entries()]
      .filter(([page]) => page !== '(other page)')
      .sort((a, b) => b[1] - a[1])
      .map(([page, n]) => ({ value: page, label: page, n })),
    conversions: [...conversions.entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1])
      .map(([step, n]) => ({ value: step, label: stepLabel(step).slice(2), n })),
  };
}

/* ---- the diagram ------------------------------------------------------------------ */

export type NodeKind = 'source' | 'page' | 'conversion' | 'other';

export type FlowNode = {
  id: string;
  col: number;
  /** Raw key: a step, `@<source>` for an outside source, or `(other)`. */
  key: string;
  kind: NodeKind;
  label: string;
  /** Visits passing through this node. */
  value: number;
  /** Of those, visits that ended here (left the site). */
  exits: number;
};

export type FlowLink = { source: string; target: string; value: number };

export type FlowGraph = {
  columns: FlowNode[][];
  links: FlowLink[];
  /** Header per column. */
  headers: string[];
  /** Visits in the diagram, and how many of them converted (anywhere in the visit). */
  visits: number;
  converted: number;
};

const OTHER = '(other)';

function nodeKind(key: string): NodeKind {
  if (key === OTHER) return 'other';
  if (key.startsWith('@')) return 'source';
  if (isConversion(key)) return 'conversion';
  return key === '(other page)' ? 'other' : 'page';
}

/**
 * Build the column graph. Column 0 is where the visits came from: the outside
 * source when starting at the visit's entry, or the previous step (or source)
 * when starting at a page. Columns 1.. are the steps from the start on.
 * Per column the `keep` biggest pages stay, the rest fold into one "Other"
 * node; conversion nodes never fold – they are what the diagram is for.
 */
export function buildFlow(paths: PathGroup[], f: FlowFilter, keep = 6): FlowGraph {
  type Walk = { seq: string[]; ended: boolean; n: number; converted: boolean };
  const walks: Walk[] = [];
  let visits = 0;
  let converted = 0;
  for (const p of paths) {
    if (!matches(p, f)) continue;
    const source = `@${p.src}|${p.ch}`;
    let seq: string[];
    let endIdx: number; // index in p.steps of the last shown step
    if (f.start === 'entry') {
      seq = [source, ...p.steps.slice(0, f.depth)];
      endIdx = Math.min(f.depth, p.steps.length) - 1;
    } else {
      const k = p.steps.indexOf(f.start);
      if (k < 0) continue;
      seq = [k > 0 ? p.steps[k - 1] : source, ...p.steps.slice(k, k + f.depth)];
      endIdx = Math.min(k + f.depth, p.steps.length) - 1;
    }
    const conv = p.steps.some(isConversion);
    visits += p.n;
    if (conv) converted += p.n;
    walks.push({ seq, ended: !p.more && endIdx === p.steps.length - 1, n: p.n, converted: conv });
  }

  const cols = f.depth + 1;
  // Raw totals per column, to decide what folds.
  const totals: Map<string, number>[] = Array.from({ length: cols }, () => new Map());
  for (const w of walks) {
    w.seq.forEach((key, c) => totals[c].set(key, (totals[c].get(key) ?? 0) + w.n));
  }
  const keepSets = totals.map((m) => {
    const ranked = [...m.entries()]
      .filter(([key]) => !isConversion(key))
      .sort((a, b) => b[1] - a[1]);
    // Folding a single node into "Other" saves nothing.
    const limit = ranked.length === keep + 1 ? keep + 1 : keep;
    return new Set(ranked.slice(0, limit).map(([key]) => key));
  });
  const fold = (c: number, key: string) =>
    isConversion(key) || keepSets[c].has(key) ? key : OTHER;

  const nodes = new Map<string, FlowNode>();
  const links = new Map<string, FlowLink>();
  const nodeId = (c: number, key: string) => `${c}|${key}`;
  for (const w of walks) {
    const keys = w.seq.map((key, c) => fold(c, key));
    keys.forEach((key, c) => {
      const id = nodeId(c, key);
      let node = nodes.get(id);
      if (!node) {
        const kind = nodeKind(key);
        const [src, ch] = key.slice(1).split('|');
        node = {
          id,
          col: c,
          key,
          kind,
          label:
            kind === 'source'
              ? sourceLabel(src, ch)
              : key === OTHER
                ? c === 0 && f.start === 'entry' ? 'Other sources' : 'Other pages'
                : stepLabel(key),
          value: 0,
          exits: 0,
        };
        nodes.set(id, node);
      }
      node.value += w.n;
      if (c === keys.length - 1 && w.ended) node.exits += w.n;
      if (c > 0) {
        const lid = `${nodeId(c - 1, keys[c - 1])}>${id}`;
        const link = links.get(lid) ?? { source: nodeId(c - 1, keys[c - 1]), target: id, value: 0 };
        link.value += w.n;
        links.set(lid, link);
      }
    });
  }

  // Order inside a column: pages by size, "Other" after them, conversions last.
  const order = (n: FlowNode) => (n.kind === 'conversion' ? 2 : n.kind === 'other' ? 1 : 0);
  const columns = Array.from({ length: cols }, (_, c) =>
    [...nodes.values()]
      .filter((n) => n.col === c)
      .sort((a, b) => order(a) - order(b) || b.value - a.value),
  ).filter((col) => col.length > 0);

  const headers = columns.map((_, c) => {
    if (c === 0) return f.start === 'entry' ? 'Came from' : 'Before';
    if (f.start === 'entry' && c === 1) return 'Step 1 · entry page';
    if (f.start !== 'entry' && c === 1) return 'This page';
    const n = f.start === 'entry' ? c : c - 1;
    return f.start === 'entry' ? `Step ${n}` : `+${n}`;
  });

  return { columns, links: [...links.values()], headers, visits, converted };
}

/* ---- journeys ------------------------------------------------------------------ */

export type JourneyRow = { steps: string[]; cut: boolean; more: boolean; n: number };

/**
 * Most common journeys. For `all`: visits with at least two steps, first
 * `len` steps. For a conversion marker: visits that made that conversion,
 * cut at the conversion – the path that led there (the last `len` steps, with
 * `cut` set when earlier steps were dropped).
 */
export function topJourneys(paths: PathGroup[], outcome: Outcome, len = 5, limit = 10) {
  const groups = new Map<string, JourneyRow>();
  let total = 0;
  let single = 0;
  for (const p of paths) {
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
