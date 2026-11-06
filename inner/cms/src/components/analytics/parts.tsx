'use client';
import React from 'react';

/**
 * Small building blocks shared by the /admin/analytics sections (website and
 * applications): number formatting, KPI tiles with sparkline + delta, labelled
 * bar lists and the card frame.
 */

export const nf = new Intl.NumberFormat('en-GB');
export const nfCompact = new Intl.NumberFormat('en-GB', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
export const fmtInt = (v: number) => nf.format(v);
export const fmtCompact = (v: number) => (v < 10000 ? nf.format(v) : nfCompact.format(v));

/** Table row label for a series bucket: the date, plus hours when intraday. */
export const fmtBucketRow = (bucket: string, bucketHours: number): string => {
  if (bucketHours >= 24) return bucket.slice(0, 10);
  const from = Number(bucket.slice(11, 13));
  const to = (from + bucketHours) % 24;
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${bucket.slice(0, 10)} ${pad(from)}:00–${pad(to)}:00`;
};

/** Sum an array into at most `buckets` points (sparkline downsampling). */
function downsample(values: number[], buckets = 12): number[] {
  if (values.length <= buckets) return values;
  const size = values.length / buckets;
  const out: number[] = [];
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * size);
    const end = Math.max(Math.floor((b + 1) * size), start + 1);
    out.push(values.slice(start, end).reduce((a, v) => a + v, 0));
  }
  return out;
}

export function Sparkline({ values }: { values: number[] }) {
  const points = downsample(values);
  const W = 96;
  const H = 28;
  const PAD = 3;
  const max = Math.max(...points, 1);
  const x = (i: number) =>
    PAD + (points.length <= 1 ? (W - 2 * PAD) / 2 : (i * (W - 2 * PAD)) / (points.length - 1));
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = points.length - 1;
  return (
    <svg width={W} height={H} className="cfc-spark" aria-hidden="true">
      <path d={d} fill="none" stroke="var(--cfc-muted)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(last)} cy={y(points[last])} r={3} fill="var(--cfc-s1)" stroke="var(--cfc-surface)" strokeWidth={2} />
    </svg>
  );
}

export function Delta({
  current,
  previous,
  unit = '%',
  vs,
}: {
  current: number;
  previous: number;
  /** '%' = relative change of counts; 'pp' = absolute difference of two rates. */
  unit?: '%' | 'pp';
  vs: string;
}) {
  let text: string;
  let dir: 0 | 1 | -1 = 0;
  if (unit === 'pp') {
    const diff = Math.round((current - previous) * 10) / 10;
    dir = diff > 0 ? 1 : diff < 0 ? -1 : 0;
    text = `${diff > 0 ? '+' : ''}${diff} pp`;
  } else if (previous === 0) {
    if (current === 0) {
      return <span className="cfc-tile__delta cfc-tile__delta--flat">— vs {vs}</span>;
    }
    text = 'new';
    dir = 1;
  } else {
    const pct = Math.round(((current - previous) / previous) * 1000) / 10;
    dir = pct > 0 ? 1 : pct < 0 ? -1 : 0;
    text = `${pct > 0 ? '+' : ''}${pct}%`;
  }
  const cls =
    dir > 0 ? 'cfc-tile__delta--up' : dir < 0 ? 'cfc-tile__delta--down' : 'cfc-tile__delta--flat';
  return (
    <span className={`cfc-tile__delta ${cls}`}>
      {dir !== 0 && <span aria-hidden="true">{dir > 0 ? '▲' : '▼'} </span>}
      {text} vs {vs}
    </span>
  );
}

export function StatTile({
  label,
  value,
  delta,
  caption,
  spark,
  className,
}: {
  label: string;
  value: string;
  delta?: React.ReactNode;
  caption?: string;
  spark?: number[];
  className?: string;
}) {
  return (
    <div className={`cfc-card cfc-tile ${className ?? ''}`}>
      <div className="cfc-tile__label">{label}</div>
      <div className="cfc-tile__row">
        <span className="cfc-tile__value">{value}</span>
        {spark && spark.some((v) => v > 0) && <Sparkline values={spark} />}
      </div>
      {delta}
      {caption && <div className="cfc-tile__caption">{caption}</div>}
    </div>
  );
}

export type BarItem = {
  label: string;
  value: number;
  valueText?: string;
  color?: string;
};

/** Labeled horizontal bar rows — every value is printed, bars reinforce. */
export function BarList({ items, ariaLabel }: { items: BarItem[]; ariaLabel: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="cfc-bars" role="list" aria-label={ariaLabel}>
      {items.map((item) => (
        <div className="cfc-bars__row" role="listitem" key={item.label}>
          <div className="cfc-bars__meta">
            <span className="cfc-bars__label" title={item.label}>
              {item.label}
            </span>
            <span className="cfc-bars__value">{item.valueText ?? fmtInt(item.value)}</span>
          </div>
          <div className="cfc-bars__track">
            <div
              className="cfc-bars__bar"
              style={{
                width: `${Math.max((item.value / max) * 100, item.value > 0 ? 1 : 0)}%`,
                background: item.color ?? 'var(--cfc-s1)',
              }}
            />
          </div>
        </div>
      ))}
      {items.length === 0 && <div className="cfc-empty-line">No data in this range.</div>}
    </div>
  );
}

/** Share in whole percent; 0 when there is no whole. */
export const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export function Card({
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

