'use client';
import React, { useMemo, useState } from 'react';

/**
 * Session share by traffic source — the donut that sits beside the traffic
 * chart. Part-to-whole at a glance, capped at five segments: the top four
 * sources (campaign tag, else referrer host) in categorical slots 1–4, plus a
 * de-emphasis gray "Other". The cap is a colour-safety constraint, not a
 * style choice: with five hued slots the last slot (magenta) is
 * near-indistinguishable from the gray under deuteranopia, so the tail folds
 * one segment earlier. Segment colours were validated with the dataviz
 * palette checker against both admin surfaces, including the gray↔slot-1
 * wrap-around pair.
 *
 * Values are never colour- or hover-gated: the legend prints every segment's
 * sessions and share, and the centre readout mirrors the hovered/focused
 * segment (keyboard reachable — each segment is focusable).
 */

export type SourceShare = { source: string; channel: string; sessions: number };

const SLOT_COLORS = [
  'var(--cfc-s1)',
  'var(--cfc-s2)',
  'var(--cfc-s3)',
  'var(--cfc-s4)',
];
const OTHER_COLOR = 'var(--cfc-other)';

/**
 * Short channel word behind the source name, so "google" (a campaign tag) and
 * "google.com" (the organic referrer) don't read as a duplicate. Direct is
 * omitted — "(direct)" already says it.
 */
export const CHANNEL_TAGS: Record<string, string> = {
  campaign: 'tagged',
  organic_search: 'search',
  social: 'social',
  referral: 'referral',
};

const SIZE = 168;
const R_OUTER = 80;
const R_INNER = 57;
const R_MID = (R_OUTER + R_INNER) / 2;
/** Half of the 2px surface gap between segments, as an angle at mid-radius. */
const PAD_ANGLE = 1 / R_MID;

const nf = new Intl.NumberFormat('en-GB');
const nfCompact = new Intl.NumberFormat('en-GB', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const fmtCompact = (v: number) => (v < 10000 ? nf.format(v) : nfCompact.format(v));

/** Annular sector between two clockwise angles (radians, 0 = 12 o'clock). */
function arcPath(a0: number, a1: number): string {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const pt = (r: number, a: number) =>
    `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return (
    `M${pt(R_OUTER, a0)}` +
    `A${R_OUTER} ${R_OUTER} 0 ${large} 1 ${pt(R_OUTER, a1)}` +
    `L${pt(R_INNER, a1)}` +
    `A${R_INNER} ${R_INNER} 0 ${large} 0 ${pt(R_INNER, a0)}Z`
  );
}

type Segment = {
  label: string;
  /** Short channel word for the legend ('' when redundant or unknown). */
  channelTag: string;
  sessions: number;
  pct: number;
  color: string;
  isOther: boolean;
};

export function SourceDonut({
  share,
  totalSessions,
}: {
  share: SourceShare[];
  totalSessions: number;
}) {
  const [active, setActive] = useState<number | null>(null);

  const segments = useMemo<Segment[]>(() => {
    const top = share.filter((s) => s.sessions > 0).slice(0, SLOT_COLORS.length);
    const other = Math.max(
      0,
      totalSessions - top.reduce((a, s) => a + s.sessions, 0),
    );
    const rows: Segment[] = top.map((s, i) => ({
      label: s.source,
      channelTag: CHANNEL_TAGS[s.channel] ?? '',
      sessions: s.sessions,
      pct: 0,
      color: SLOT_COLORS[i],
      isOther: false,
    }));
    if (other > 0) {
      rows.push({
        label: 'Other',
        channelTag: '',
        sessions: other,
        pct: 0,
        color: OTHER_COLOR,
        isOther: true,
      });
    }
    const total = rows.reduce((a, s) => a + s.sessions, 0);
    return rows.map((s) => ({
      ...s,
      pct: total ? Math.round((s.sessions / total) * 100) : 0,
    }));
  }, [share, totalSessions]);

  const total = segments.reduce((a, s) => a + s.sessions, 0);
  if (total === 0) {
    return <div className="cfc-empty-line">No sessions in this range.</div>;
  }

  // Clockwise from 12 o'clock, biggest slice first (the query pre-sorts).
  let angle = 0;
  const arcs = segments.map((s) => {
    const sweep = (s.sessions / total) * Math.PI * 2;
    const a0 = angle;
    angle += sweep;
    return { seg: s, a0, a1: angle };
  });

  const shown = active !== null ? segments[active] : null;

  return (
    <div className="cfc-donut">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="cfc-donut__plot"
        role="group"
        aria-label="Share of sessions by source"
      >
        {segments.length === 1 ? (
          // A single source has no gaps to draw — render the full ring.
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R_MID}
            fill="none"
            stroke={segments[0].color}
            strokeWidth={R_OUTER - R_INNER}
            className={`cfc-donut__seg ${active === 0 ? 'is-active' : ''}`}
            tabIndex={0}
            role="img"
            aria-label={`${segments[0].label}${
              segments[0].channelTag ? ` (${segments[0].channelTag})` : ''
            }: ${nf.format(segments[0].sessions)} sessions, 100%`}
            onPointerEnter={() => setActive(0)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(0)}
            onBlur={() => setActive(null)}
          />
        ) : (
          arcs.map(({ seg, a0, a1 }, i) => (
            <path
              key={seg.label}
              d={arcPath(
                Math.min(a0 + PAD_ANGLE, (a0 + a1) / 2),
                Math.max(a1 - PAD_ANGLE, (a0 + a1) / 2),
              )}
              fill={seg.color}
              className={`cfc-donut__seg ${active === i ? 'is-active' : ''}`}
              tabIndex={0}
              role="img"
              aria-label={`${seg.label}${
                seg.channelTag ? ` (${seg.channelTag})` : ''
              }: ${nf.format(seg.sessions)} sessions, ${seg.pct}%`}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            />
          ))
        )}
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 2}
          textAnchor="middle"
          className="cfc-donut__value"
        >
          {shown ? fmtCompact(shown.sessions) : fmtCompact(total)}
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 16}
          textAnchor="middle"
          className="cfc-donut__label"
        >
          {shown ? `${shown.pct}% of sessions` : 'sessions'}
        </text>
      </svg>
      <div className="cfc-donut__legend">
        {segments.map((s, i) => (
          <div
            key={s.label}
            className={`cfc-donut__row ${active === i ? 'is-active' : ''}`}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
          >
            <span
              className="cfc-legend__key cfc-legend__key--rect"
              style={{ background: s.color }}
            />
            <span
              className="cfc-donut__name"
              title={s.channelTag ? `${s.label} (${s.channelTag})` : s.label}
            >
              {s.label}
              {s.channelTag && <span className="cfc-donut__chan"> · {s.channelTag}</span>}
            </span>
            <span className="cfc-donut__count">
              {nf.format(s.sessions)} · {s.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
