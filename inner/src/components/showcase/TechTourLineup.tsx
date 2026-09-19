'use client';
import React, { useEffect, useId, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { mediaUrl } from '../../api';
import type { CmsTechTourEvent } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * The line-up: one app icon per evening, and a single glowing line that runs
 * into each icon, traces a frame around it and carries on to the next. The
 * line draws itself once, the first time the page is actually on screen.
 *
 * The line stops dead at a frame's left edge, goes once around it, and picks
 * up again at the frame's right edge — one path with a jump in it, and no
 * stroke inside a frame at all. Running it behind the icon instead reads as
 * the line passing *under* the artwork: the frame sits a few pixels clear of
 * the tile, so the leg showed in that gap and crossed the frame's own outline
 * on the way in and out.
 *
 * It is revealed by a mask sweeping left to right, not by stroke-dasharray.
 * Dashing restarts at every subpath, so the jumps above would have set all six
 * pieces drawing at once, in parallel — which is the opposite of one line
 * travelling the row. A sweep cannot do that: there is one leading edge, and
 * everything appears as it passes. It also means the arrival points are plain
 * geometry (where each frame starts along the sweep) instead of path lengths.
 *
 * Reaching an icon *activates* it: until the line arrives, an icon sits dark
 * and colourless; the moment it does, the icon lights up and the whole poster
 * takes a knock (the `onHit` callback — TechTour.tsx shakes it). The arrival
 * points come from measuring the path's own prefixes, so they stay in step
 * with the drawing however the row is laid out.
 *
 * The line is rebuilt from measured layout whenever the row resizes, and
 * dropped entirely once the row wraps to more than one line — a rail threaded
 * through a grid would be nonsense — or once the viewport is narrow enough
 * that the icons have shrunk to phone size (`WIRE_MIN_WIDTH`).
 */

/** How long the line takes to draw itself, and how long it waits first. */
const DRAW_S = 3.8;
const DELAY_S = 0.3;
/** How far outside an icon its frame sits, in px. */
const OUTSET = 7;
/** How far the line runs past the row on each side, in px. The SVG does not
 *  clip, and the page does, so it leaves the screen rather than stopping. */
const RUN_OFF = 220;
/** Icons whose centres sit this close together count as one row. */
const SAME_ROW_TOL = 8;
/** Below this width there is no wire. It is the poster's own layout
 *  breakpoint (landing.css), where the row shrinks to phone-sized icons: the
 *  frames stand `OUTSET` clear on each side, which is most of the gap a phone
 *  has between two tiles, so the line would thread itself through its own
 *  frames. Without it every icon is lit from the start, which is what a
 *  screen you are holding wants anyway. */
const WIRE_MIN_WIDTH = 901;

interface Box {
    x: number;
    y: number;
    size: number;
}

/**
 * One icon's frame as a rounded rectangle, entered and left at the middle of
 * its left edge so the whole line can be a single path: line in, once around,
 * line on to the next.
 */
const frameLoop = (b: Box): string => {
    const x = b.x - OUTSET;
    const y = b.y - OUTSET;
    const s = b.size + 2 * OUTSET;
    // Matches the icons' own corner curve (24% of their width) plus the outset.
    const r = Math.min(s / 2, b.size * 0.24 + OUTSET);
    const cy = y + s / 2;
    return [
        `L${x} ${y + r}`,
        `Q${x} ${y} ${x + r} ${y}`,
        `L${x + s - r} ${y}`,
        `Q${x + s} ${y} ${x + s} ${y + r}`,
        `L${x + s} ${y + s - r}`,
        `Q${x + s} ${y + s} ${x + s - r} ${y + s}`,
        `L${x + r} ${y + s}`,
        `Q${x} ${y + s} ${x} ${y + s - r}`,
        `L${x} ${cy}`,
    ].join('');
};

/**
 * The whole line: in from the left, around every icon, out to the right — plus
 * the fraction of the sweep at which each icon's frame starts to appear, which
 * is what the activations are timed off.
 */
const buildWire = (
    boxes: Box[],
    width: number
): { d: string; span: number; arrivals: number[] } => {
    const cy = boxes[0].y + boxes[0].size / 2;
    const right = (b: Box) => b.x + b.size + OUTSET;
    // The sweep runs from off the left edge to off the right one.
    const span = width + 2 * RUN_OFF;
    let d = `M${-RUN_OFF} ${cy}`;
    boxes.forEach((b, i) => {
        // The frame loop ends where it began, at the left edge, so the leg on
        // is picked up at the far side of the frame instead of being dragged
        // across the tile.
        if (i > 0) d += `M${right(boxes[i - 1])} ${cy}`;
        d += `L${b.x - OUTSET} ${cy}`;
        d += frameLoop(b);
    });
    d += `M${right(boxes[boxes.length - 1])} ${cy}L${width + RUN_OFF} ${cy}`;
    return { d, span, arrivals: boxes.map((b) => (b.x - OUTSET + RUN_OFF) / span) };
};

export interface TechTourLineupProps {
    events: CmsTechTourEvent[];
    /** Localised "company to be announced", for slots without a host yet. */
    tbaLabel: string;
    /** Fires each time the line reaches an icon, so the page can take a knock. */
    onHit?: () => void;
    /** Fires once the line has finished drawing. */
    onDone?: () => void;
    /** Clicking a tile: the index of the evening to go to. */
    onPick?: (index: number) => void;
    /** "Click to learn more", shown under a tile on hover. */
    hint?: string;
}

const TechTourLineup: React.FC<TechTourLineupProps> = ({
    events,
    tbaLabel,
    onHit,
    onDone,
    onPick,
    hint,
}) => {
    const { locale } = useLanguage();
    const reduced = useReducedMotion();
    const rootRef = useRef<HTMLDivElement>(null);
    const rowRef = useRef<HTMLOListElement>(null);
    const drawn = useMotionValue(0);
    const [live, setLive] = useState<number>(0);
    const fired = useRef(0);
    // One clip path per instance: two line-ups on a page must not share an id.
    const wipeId = `tt-wipe-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

    const dateLocale = locale === 'de' ? 'de-DE' : 'en-GB';

    // The line draws itself once. Reduced motion gets it already drawn and
    // perfectly still.
    useEffect(() => {
        if (reduced) {
            drawn.set(1);
            return;
        }
        drawn.set(0);
        let controls: ReturnType<typeof animate> | undefined;
        // A page opened behind another tab gets no animation frames, but the
        // clock keeps running — start it on mount and by the time anyone looks
        // the line is already drawn, all five icons lighting at once. So it
        // waits until the page is actually on screen.
        const start = () => {
            if (!controls && document.visibilityState === 'visible') {
                controls = animate(drawn, 1, {
                    duration: DRAW_S,
                    delay: DELAY_S,
                    ease: [0.33, 0, 0.2, 1],
                });
            }
        };
        start();
        document.addEventListener('visibilitychange', start);
        return () => {
            document.removeEventListener('visibilitychange', start);
            controls?.stop();
        };
    }, [reduced, drawn]);

    // Where the icons ended up. Measured from layout rather than from
    // getBoundingClientRect so the icons' own entrance transform cannot feed
    // back into it.
    const [geom, setGeom] = useState<{
        w: number;
        h: number;
        d: string;
        span: number;
        arrivals: number[];
    } | null>(null);
    useEffect(() => {
        const root = rootRef.current;
        const row = rowRef.current;
        if (!root || !row || events.length === 0) return;
        const measure = () => {
            if (window.innerWidth < WIRE_MIN_WIDTH) return setGeom(null);
            const icons = Array.from(row.querySelectorAll<HTMLElement>('.lp-tt-slot__icon'));
            if (icons.length !== events.length) return setGeom(null);
            const boxes = icons.map((el) => {
                let x = 0;
                let y = 0;
                for (let node: HTMLElement | null = el; node && node !== root; ) {
                    x += node.offsetLeft;
                    y += node.offsetTop;
                    node = node.offsetParent as HTMLElement | null;
                }
                return { x, y, size: el.offsetWidth };
            });
            const oneRow = boxes.every((b) => Math.abs(b.y - boxes[0].y) <= SAME_ROW_TOL);
            if (!oneRow) return setGeom(null);
            const w = root.offsetWidth;
            setGeom({ w, h: root.offsetHeight, ...buildWire(boxes, w) });
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(root);
        window.addEventListener('resize', measure);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [events.length]);

    // How far the sweep has travelled, in the SVG's own units.
    const wipe = useTransform(drawn, (v) => (geom ? geom.span * v : 0));

    // Light each icon up as the line gets to it, and knock the page with it.
    // Without the line (a wrapped row, or a viewport too narrow for one) there
    // is nothing to wait for, so everything is live from the start.
    useEffect(() => {
        if (!geom) {
            // No line to wait for (a wrapped row, or a viewport too narrow for
            // one): everything is live at once, and the page is already as
            // "done" as it is going to get.
            fired.current = events.length;
            setLive(events.length);
            onDone?.();
            return;
        }
        fired.current = 0;
        setLive(0);
        const fire = (v: number) => {
            let now = fired.current;
            while (now < geom.arrivals.length && v >= geom.arrivals[now]) now += 1;
            if (now === fired.current) return;
            fired.current = now;
            setLive(now);
            if (!reduced) onHit?.();
        };
        fire(drawn.get());
        const unsubscribe = drawn.on('change', (v) => {
            fire(v);
            if (v >= 1) onDone?.();
        });
        if (drawn.get() >= 1) onDone?.();
        return unsubscribe;
    }, [geom, drawn, events.length, reduced, onHit, onDone]);

    return (
        <div className="lp-tt-lineup" ref={rootRef}>
            {geom && (
                <svg
                    className="lp-tt-lineup__wire"
                    viewBox={`0 0 ${geom.w} ${geom.h}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    <defs>
                        <clipPath id={wipeId} clipPathUnits="userSpaceOnUse">
                            {/* Tall enough to clear the frames, which stand well
                                above and below the rail. */}
                            <motion.rect
                                x={-RUN_OFF}
                                y={-geom.h}
                                width={wipe}
                                height={geom.h * 3}
                            />
                        </clipPath>
                    </defs>
                    <g clipPath={`url(#${wipeId})`}>
                        <path d={geom.d} />
                    </g>
                </svg>
            )}
            <ol
                className="lp-tt-lineup__row"
                ref={rowRef}
                style={{ '--tt-cols': Math.min(events.length, 5) } as React.CSSProperties}
            >
                {events.map((ev, i) => {
                    const tba = ev.status === 'tba';
                    const logo = mediaUrl(ev.logo);
                    // `company` is not localised in the CMS, so a placeholder
                    // slot shows the translated label rather than what was typed.
                    const company = tba ? tbaLabel : ev.company;
                    const date = new Date(ev.date);
                    const icon = (
                        <span
                            className={`lp-tt-slot__icon${tba ? ' lp-tt-slot__icon--tba' : ''}${
                                i < live ? ' is-live' : ''
                            }`}
                        >
                            {tba ? (
                                <span aria-hidden="true">?</span>
                            ) : logo ? (
                                <img src={logo} alt={`${company} logo`} loading="eager" />
                            ) : (
                                <span className="lp-tt-slot__initial">
                                    {company.trim().charAt(0)}
                                </span>
                            )}
                        </span>
                    );
                    return (
                        <li
                            className={`lp-tt-slot${i < live ? ' is-live' : ''}`}
                            key={ev.id ?? i}
                        >
                            {onPick ? (
                                <button
                                    type="button"
                                    className="lp-tt-slot__link"
                                    onClick={() => onPick(i)}
                                    aria-label={`${company} — ${hint ?? ''}`.trim()}
                                >
                                    {icon}
                                    {hint && <span className="lp-tt-slot__hint">{hint}</span>}
                                </button>
                            ) : (
                                icon
                            )}
                            <span className="lp-tt-slot__day">
                                {date.toLocaleDateString(dateLocale, { weekday: 'short' })}
                            </span>
                            <span className="lp-tt-slot__date">
                                {date.toLocaleDateString(dateLocale, {
                                    day: 'numeric',
                                    month: 'short',
                                })}
                            </span>
                            <span className="lp-tt-slot__name">{company}</span>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
};

export default TechTourLineup;
