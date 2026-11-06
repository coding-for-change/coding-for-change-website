'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FlowGraph, FlowLink, FlowNode } from './flowModel';
import { fmtInt, pct } from './parts';

/**
 * The visitor-flow diagram: one column per step, a bar per page / source /
 * conversion sized by visits, and bands between columns sized by how many
 * visits moved that way. The faded end of a bar is the share that left the
 * site there. Hand-drawn SVG (no chart library) – the layout is strictly
 * column to column, so it's a few lines of arithmetic.
 *
 * Hover a bar or band for numbers; click a bar to re-filter (see `onPick`).
 */

const NODE_W = 12;
const GAP = 14; // between bars in a column – fits a one-line label
const PAD_T = 30; // room for the column headers
const PAD_B = 8;
const LABEL_ROOM = 220; // right of the last column – fits "✓ Membership application 123"
const MIN_H = 2;

type Placed = FlowNode & { x: number; y: number; h: number };
type PlacedLink = FlowLink & { y0: number; y1: number; w: number; x0: number; x1: number };

const FILL: Record<FlowNode['kind'], string> = {
  page: 'var(--cfc-s1)',
  conversion: 'var(--cfc-s3)',
  source: 'var(--cfc-other)',
  other: 'var(--cfc-muted)',
};

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function layout(graph: FlowGraph, width: number) {
  const cols = graph.columns.length;
  const maxNodes = Math.max(...graph.columns.map((c) => c.length), 1);
  const plotH = Math.min(Math.max(340, maxNodes * 56), 640);
  const usable = plotH - GAP * (maxNodes - 1);
  const maxTotal = Math.max(...graph.columns.map((c) => c.reduce((a, n) => a + n.value, 0)), 1);
  const k = usable / maxTotal;
  const span = Math.max(width - LABEL_ROOM - NODE_W, 200);
  const colX = (c: number) => (cols <= 1 ? 0 : (c * span) / (cols - 1));

  // Columns 0 and 1 keep the model's order (biggest first) – sources and entry
  // pages read best by size, and every source feeds mostly "/" anyway. Later
  // columns put their pages in the order of where their visits came from (the
  // weighted mean height of the incoming bands) – the classic barycentre
  // heuristic, which removes most band crossings. "Other" and conversions
  // stay at the bottom.
  const incoming = new Map<string, FlowLink[]>();
  for (const l of graph.links) incoming.set(l.target, [...(incoming.get(l.target) ?? []), l]);
  const nodes = new Map<string, Placed>();
  let bottom = 0;
  graph.columns.forEach((col, c) => {
    let ordered = col;
    if (c > 1) {
      const centre = (n: FlowNode) => {
        const ins = incoming.get(n.id) ?? [];
        const total = ins.reduce((a, l) => a + l.value, 0) || 1;
        return ins.reduce((a, l) => {
          const s = nodes.get(l.source)!;
          return a + (s.y + s.h / 2) * l.value;
        }, 0) / total;
      };
      const pages = col.filter((n) => n.kind === 'page' || n.kind === 'source');
      const rest = col.filter((n) => n.kind !== 'page' && n.kind !== 'source');
      const pos = new Map(pages.map((n) => [n.id, centre(n)]));
      ordered = [...pages.sort((a, b) => pos.get(a.id)! - pos.get(b.id)!), ...rest];
    }
    let y = PAD_T;
    for (const n of ordered) {
      const h = Math.max(n.value * k, MIN_H);
      nodes.set(n.id, { ...n, x: colX(c), y, h });
      y += h + GAP;
    }
    bottom = Math.max(bottom, y - GAP);
  });
  const height = bottom + PAD_B + 14; // room for a label under the lowest bar

  // Bands leave a bar top-down in the order of their targets, and enter a bar
  // in the order of their sources – fewest crossings for a column layout.
  // Offsets are per bar, so one pass in global target / source order fills
  // every bar in the right order.
  const yOf = (id: string) => nodes.get(id)!.y;
  const inPos = new Map<FlowLink, number>();
  const inOff = new Map<string, number>();
  for (const l of [...graph.links].sort((a, b) => yOf(a.source) - yOf(b.source))) {
    const off = inOff.get(l.target) ?? 0;
    inPos.set(l, yOf(l.target) + off + (l.value * k) / 2);
    inOff.set(l.target, off + l.value * k);
  }
  const links: PlacedLink[] = [];
  const outOff = new Map<string, number>();
  for (const l of [...graph.links].sort((a, b) => yOf(a.target) - yOf(b.target))) {
    const s = nodes.get(l.source)!;
    const off = outOff.get(l.source) ?? 0;
    links.push({
      ...l,
      w: Math.max(l.value * k, 1),
      x0: s.x + NODE_W,
      x1: nodes.get(l.target)!.x,
      y0: s.y + off + (l.value * k) / 2,
      y1: inPos.get(l)!,
    });
    outOff.set(l.source, off + l.value * k);
  }
  return { nodes, links, height, colX, k };
}

const bandPath = (l: PlacedLink) => {
  const mx = (l.x0 + l.x1) / 2;
  return `M${l.x0},${l.y0}C${mx},${l.y0} ${mx},${l.y1} ${l.x1},${l.y1}`;
};

const short = (s: string, max = 26) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

type Hover = { kind: 'node'; id: string } | { kind: 'link'; link: PlacedLink } | null;

export function FlowDiagram({
  graph,
  onPick,
}: {
  graph: FlowGraph;
  /** Click on a bar. */
  onPick: (node: FlowNode) => void;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>(1100);
  const [hover, setHover] = useState<Hover>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const { nodes, links, height, colX } = useMemo(() => layout(graph, width), [graph, width]);
  const start = graph.columns[0]?.reduce((a, n) => a + n.value, 0) ?? 0;

  const active = (l: PlacedLink) =>
    hover?.kind === 'node'
      ? l.source === hover.id || l.target === hover.id
      : hover?.kind === 'link'
        ? hover.link === l
        : false;

  const tooltip = (() => {
    if (!hover || !mouse) return null;
    if (hover.kind === 'link') {
      const s = nodes.get(hover.link.source)!;
      const t = nodes.get(hover.link.target)!;
      return (
        <>
          <div className="cfc-tooltip__date">
            {s.label} → {t.label}
          </div>
          <div>
            <strong>{fmtInt(hover.link.value)}</strong> visits · {pct(hover.link.value, s.value)}% of{' '}
            {short(s.label, 30)}
          </div>
        </>
      );
    }
    const n = nodes.get(hover.id)!;
    const outs = links.filter((l) => l.source === n.id).sort((a, b) => b.value - a.value);
    const ins = links.filter((l) => l.target === n.id).sort((a, b) => b.value - a.value);
    return (
      <>
        <div className="cfc-tooltip__date">{n.label}</div>
        <div>
          <strong>{fmtInt(n.value)}</strong> visits · {pct(n.value, start)}% of all shown
        </div>
        {n.exits > 0 && (
          <div>
            Left the site here: {fmtInt(n.exits)} ({pct(n.exits, n.value)}%)
          </div>
        )}
        {ins.length > 0 && (
          <div className="cfc-flowtip__list">
            From: {ins.slice(0, 3).map((l) => `${short(nodes.get(l.source)!.label, 22)} ${fmtInt(l.value)}`).join(' · ')}
          </div>
        )}
        {outs.length > 0 && (
          <div className="cfc-flowtip__list">
            Next: {outs.slice(0, 3).map((l) => `${short(nodes.get(l.target)!.label, 22)} ${fmtInt(l.value)}`).join(' · ')}
          </div>
        )}
      </>
    );
  })();

  return (
    <div
      className="cfc-sankey"
      ref={wrapRef}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onMouseLeave={() => {
        setHover(null);
        setMouse(null);
      }}
    >
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Visitor flow over ${graph.columns.length} steps; the table below lists every band.`}
        className={hover ? 'has-hover' : undefined}
      >
        {graph.headers.map((h, c) => (
          <text key={h} x={colX(c)} y={14} className="cfc-sankey__head">
            {h}
          </text>
        ))}

        <g fill="none">
          {links.map((l) => (
            <path
              key={`${l.source}>${l.target}`}
              d={bandPath(l)}
              strokeWidth={l.w}
              className={`cfc-sankey__band${nodes.get(l.target)!.kind === 'conversion' ? ' is-conversion' : ''}${active(l) ? ' is-active' : ''}`}
              onMouseEnter={() => setHover({ kind: 'link', link: l })}
            />
          ))}
        </g>

        {[...nodes.values()].map((n) => {
          const left = n.exits * (n.h / Math.max(n.value, 1));
          const lit = hover?.kind === 'node' && hover.id === n.id;
          return (
            <g
              key={n.id}
              className={`cfc-sankey__node${lit ? ' is-active' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`${n.label}: ${n.value} visits${n.exits ? `, ${n.exits} left here` : ''}`}
              onMouseEnter={() => setHover({ kind: 'node', id: n.id })}
              onFocus={() => setHover({ kind: 'node', id: n.id })}
              onBlur={() => setHover(null)}
              onClick={() => onPick(n)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPick(n);
                }
              }}
            >
              {/* generous hit target */}
              <rect x={n.x - 4} y={n.y - 2} width={NODE_W + 8} height={n.h + 4} fill="transparent" />
              <rect x={n.x} y={n.y} width={NODE_W} height={n.h - left} rx={2} fill={FILL[n.kind]} />
              {left > 0 && (
                <rect
                  x={n.x}
                  y={n.y + n.h - left}
                  width={NODE_W}
                  height={left}
                  rx={2}
                  fill={FILL[n.kind]}
                  opacity={0.32}
                />
              )}
              {/* every bar is labelled; the "left here" line only where it fits */}
              <text
                x={n.x + NODE_W + 6}
                y={n.y + Math.min(n.h / 2, 14)}
                dy="0.35em"
                className={`cfc-sankey__label${n.kind === 'conversion' ? ' is-conversion' : ''}`}
              >
                {short(n.label)}
                <tspan className="cfc-sankey__count"> {fmtInt(n.value)}</tspan>
                {n.exits > 0 && n.h >= 30 && (
                  <tspan x={n.x + NODE_W + 6} dy="1.3em" className="cfc-sankey__count">
                    {pct(n.exits, n.value)}% left here
                  </tspan>
                )}
              </text>
            </g>
          );
        })}
      </svg>
      {tooltip && mouse && (
        <div
          className="cfc-tooltip cfc-flowtip"
          style={{
            top: mouse.y + 14,
            left: Math.min(mouse.x + 14, Math.max(width - 300, 0)),
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}

/** Every band as a table row – the accessible / exact view of the diagram. */
export function FlowTable({ graph }: { graph: FlowGraph }) {
  const byId = new Map(graph.columns.flat().map((n) => [n.id, n]));
  const rows = [
    ...graph.links.map((l) => ({
      col: byId.get(l.source)!.col,
      from: byId.get(l.source)!.label,
      to: byId.get(l.target)!.label,
      n: l.value,
    })),
    ...graph.columns
      .flat()
      .filter((n) => n.exits > 0)
      .map((n) => ({ col: n.col, from: n.label, to: '(left the site)', n: n.exits })),
  ].sort((a, b) => a.col - b.col || b.n - a.n);
  return (
    <table className="cfc-table">
      <thead>
        <tr>
          <th>From</th>
          <th>To</th>
          <th className="num">Visits</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>
              {r.from} <span className="cfc-table__campaign">· {graph.headers[r.col]}</span>
            </td>
            <td>{r.to}</td>
            <td className="num">{fmtInt(r.n)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
