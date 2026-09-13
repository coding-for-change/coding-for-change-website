'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
    AnimatePresence,
    animate,
    motion,
    useMotionValue,
    useSpring,
    useTransform,
    type MotionValue,
} from 'framer-motion';
import { mediaUrl } from '../../api';
import type { CmsTechTourEvent } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';
import useIsMobile from '../../hooks/useIsMobile';
import './landing.css';

/**
 * The TechTour opening: the page goes black, the companies pop up one by one
 * as white bubbles joined by a teal line — the week as a constellation — and
 * as the visitor scrolls on, the stage fades and the page turns white again
 * for the ordinary content below.
 *
 * Scroll-driven, with a short automatic opener: the first bubble and the
 * headline appear on their own about half a second after mount; every further
 * bubble is tied to scroll position, so the visitor sets the pace and is never
 * locked out of the form. A hint to scroll appears after a few seconds of
 * stillness. The black comes from the page background painter
 * (`useSectionBackgrounds`): this section is a `data-bg="#000000"` band and
 * the content after it is white, so the blend back to white happens as the
 * stage scrolls out.
 *
 * Scroll progress is measured by hand (like ScrollRevealText) because on
 * desktop the site scrolls inside `.site-scroll`, not the window.
 */

export interface TechTourIntroProps {
    events: CmsTechTourEvent[];
    /** Small line above the headline, e.g. "Munich TechTour · 9–13 November 2026". */
    kicker: string;
    heading: string;
    /** Fires once, when the visitor has scrolled through the whole sequence. */
    onSeen: () => void;
    /** "Skip to registration". */
    onSkip: () => void;
}

// Where the pops happen along the scroll range [0, 1]. Progress reaches 1 the
// moment the white content band's top edge reaches the bottom of the viewport.
const POP_START = 0.06;
const POP_END = 0.76;
// The exit: over this last stretch of progress the whole viewport lightens
// from black to white while the constellation dissolves. The page background
// painter does the lightening (it blends towards the content band's white as
// the band approaches); `measure()` tells it, via the band's data-bg-window,
// to run that blend over exactly this stretch, so colour and dissolve move
// together and the band then arrives white-on-white — no edge to see.
const EXIT_START = 0.8;
const HINT_AFTER_MS = 3200;
// The content band overlaps the last viewport of this section (negative
// margin, see .lp--intro .lp-page), so the pinned stage stays put until it is
// fully covered instead of being pushed off the top.
const CURTAIN_VH = 100;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Bubble centres in % of the stage: a wave across on desktop, a zigzag down on phones. */
const layoutFor = (n: number, mobile: boolean): { x: number; y: number }[] =>
    Array.from({ length: n }, (_, i) => {
        const f = n > 1 ? i / (n - 1) : 0.5;
        return mobile
            ? { x: i % 2 === 0 ? 32 : 68, y: 18 + f * 64 }
            : { x: 12 + f * 76, y: i % 2 === 0 ? 60 : 40 };
    });

const IntroBubble: React.FC<{
    ev: CmsTechTourEvent;
    index: number;
    x: number;
    y: number;
    popAt: number;
    popLen: number;
    progress: MotionValue<number>;
    opener: MotionValue<number>;
    dateLocale: string;
    tbaLabel: string;
}> = ({ ev, index, x, y, popAt, popLen, progress, opener, dateLocale, tbaLabel }) => {
    const byScroll = useTransform(progress, [popAt, popAt + popLen], [0, 1]);
    // The first bubble also comes in with the automatic opener.
    const raw = useTransform([byScroll, opener], ([s, o]: number[]) =>
        Math.max(s, index === 0 ? o : 0)
    );
    const popped = useSpring(raw, { stiffness: 240, damping: 18, mass: 0.7 });
    const scale = useTransform(popped, [0, 1], [0.3, 1]);
    const opacity = useTransform(raw, [0, 0.6], [0, 1]);

    const tba = ev.status === 'tba';
    const logo = mediaUrl(ev.logo);
    const date = new Date(ev.date);
    return (
        <motion.div
            className="lp-tt-intro__node"
            style={{ left: `${x}%`, top: `${y}%`, x: '-50%', y: '-50%', scale, opacity }}
        >
            <div className={`lp-tt-intro__disc${tba ? ' lp-tt-intro__disc--tba' : ''}`}>
                {tba ? (
                    <span aria-hidden="true">?</span>
                ) : logo ? (
                    <img src={logo} alt={`${ev.company} logo`} loading="eager" />
                ) : (
                    <span className="lp-tt-intro__initial">{ev.company.trim().charAt(0)}</span>
                )}
            </div>
            <div className="lp-tt-intro__caption">
                <span className="lp-tt-intro__day">
                    {date.toLocaleDateString(dateLocale, { weekday: 'long' })}
                </span>
                <span className="lp-tt-intro__date">
                    {date.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}
                </span>
                <span className="lp-tt-intro__company">{tba ? tbaLabel : ev.company}</span>
            </div>
        </motion.div>
    );
};

// The line grows by moving its end point rather than via stroke-dasharray:
// dash lengths misbehave under the stage's non-uniform SVG scaling, and a
// plain solid stroke has nothing to misbehave.
const IntroLine: React.FC<{
    from: { x: number; y: number };
    to: { x: number; y: number };
    start: number;
    end: number;
    faint: boolean;
    progress: MotionValue<number>;
}> = ({ from, to, start, end, faint, progress }) => {
    const x2 = useTransform(progress, [start, end], [from.x, to.x]);
    const y2 = useTransform(progress, [start, end], [from.y, to.y]);
    return (
        <motion.line
            x1={from.x}
            y1={from.y}
            x2={x2}
            y2={y2}
            className={faint ? 'is-faint' : undefined}
            vectorEffect="non-scaling-stroke"
        />
    );
};

const TechTourIntro: React.FC<TechTourIntroProps> = ({ events, kicker, heading, onSeen, onSkip }) => {
    const { t, locale } = useLanguage();
    const isMobile = useIsMobile();
    const sectionRef = useRef<HTMLElement>(null);
    const progress = useMotionValue(0);
    const opener = useMotionValue(0);
    const [hint, setHint] = useState(false);
    const seenRef = useRef(false);
    const hintDismissed = useRef(false);

    const n = events.length;
    const points = layoutFor(n, isMobile);
    const step = n > 1 ? (POP_END - POP_START) / (n - 1) : 0;
    const popAt = (i: number) => POP_START + i * step;
    const popLen = n > 1 ? Math.min(0.08, step * 0.6) : 0.1;

    // Scroll progress through this section: 0 while its top is at the viewport
    // top, 1 when its bottom reaches the viewport bottom.
    useEffect(() => {
        const section = sectionRef.current;
        if (!section) return;
        const scroller = section.closest('.site-scroll') as HTMLElement | null;
        const target: HTMLElement | Window = scroller ?? window;
        // The white content band that follows this section (see TechTour.tsx).
        const band = section.parentElement?.querySelector<HTMLElement>('[data-bg="#ffffff"]') ?? null;
        let raf = 0;
        const measure = () => {
            raf = 0;
            const rect = section.getBoundingClientRect();
            const viewTop = scroller ? scroller.getBoundingClientRect().top : 0;
            const viewH = scroller ? scroller.clientHeight : window.innerHeight;
            // Exclude the overlapped viewport: 1 = the band's top edge has just
            // reached the bottom of the viewport.
            const range = Math.max(1, rect.height - 2 * viewH);
            progress.set(clamp01((viewTop - rect.top) / range));
            // Align the background blend with the exit stretch: the band's top
            // sits `start` viewports below the viewport top when progress is
            // EXIT_START, and exactly one viewport (its bottom edge) at 1.
            if (band) {
                const start = 1 + ((1 - EXIT_START) * range) / viewH;
                const window_ = `${start.toFixed(3)} 1`;
                if (band.dataset.bgWindow !== window_) band.dataset.bgWindow = window_;
            }
        };
        const onScroll = () => {
            if (!raf) raf = requestAnimationFrame(measure);
        };
        measure();
        target.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            target.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [progress]);

    // Automatic opener: headline + first bubble, half a second after mount.
    useEffect(() => {
        const controls = animate(opener, 1, { duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] });
        return () => controls.stop();
    }, [opener]);

    // Nudge after a few still seconds; gone for good once the visitor moves.
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!hintDismissed.current && progress.get() < 0.03) setHint(true);
        }, HINT_AFTER_MS);
        const unsub = progress.on('change', (v) => {
            if (v > 0.03 && !hintDismissed.current) {
                hintDismissed.current = true;
                setHint(false);
            }
            if (v >= 0.9 && !seenRef.current) {
                seenRef.current = true;
                onSeen();
            }
        });
        return () => {
            clearTimeout(timer);
            unsub();
        };
    }, [progress, onSeen]);

    // The headline steps aside once the constellation is nearly complete.
    const headOpacity = useTransform([opener, progress], ([o, p]: number[]) =>
        Math.min(o, 1 - clamp01((p - 0.56) / 0.16))
    );
    // Everything on the stage dissolves while the page lightens.
    const sceneOpacity = useTransform(progress, [EXIT_START, 1], [1, 0]);
    const headY = useTransform(opener, [0, 1], [18, 0]);
    const dateLocale = locale === 'de' ? 'de-DE' : 'en-GB';
    const height = (isMobile ? 90 + n * 40 : 100 + n * 55) + CURTAIN_VH;

    return (
        <section
            ref={sectionRef}
            className="lp-tt-intro"
            data-bg="#000000"
            style={{ height: `${height}vh` }}
            aria-label={heading}
        >
            <div className="lp-tt-intro__stage">
              <motion.div className="lp-tt-intro__scene" style={{ opacity: sceneOpacity }}>
                <motion.div className="lp-tt-intro__head" style={{ opacity: headOpacity, y: headY }}>
                    <p className="lp-tt-intro__kicker">{kicker}</p>
                    <h2 className="lp-tt-intro__title">{heading}</h2>
                    {/* The hint lives up here, not at the bottom: on a first
                        visit the consent banner owns the bottom of the screen. */}
                    <AnimatePresence>
                        {hint && (
                            <motion.div
                                className="lp-tt-intro__hint"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                transition={{ duration: 0.4 }}
                                aria-live="polite"
                            >
                                {t.techtour.introHint}
                                <span className="lp-tt-intro__hint-arrow" aria-hidden="true">
                                    ↓
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                <svg
                    className="lp-tt-intro__lines"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    {points.slice(0, -1).map((p, i) => (
                        <IntroLine
                            key={i}
                            from={p}
                            to={points[i + 1]}
                            start={popAt(i) + popLen * 0.5}
                            end={popAt(i + 1) + popLen * 0.4}
                            faint={events[i].status === 'tba' || events[i + 1].status === 'tba'}
                            progress={progress}
                        />
                    ))}
                </svg>

                {events.map((ev, i) => (
                    <IntroBubble
                        key={ev.id ?? i}
                        ev={ev}
                        index={i}
                        x={points[i].x}
                        y={points[i].y}
                        popAt={popAt(i)}
                        popLen={popLen}
                        progress={progress}
                        opener={opener}
                        dateLocale={dateLocale}
                        tbaLabel={t.techtour.tbaCompany}
                    />
                ))}

                <button type="button" className="lp-tt-intro__skip" onClick={onSkip}>
                    {t.techtour.introSkip} ↓
                </button>
              </motion.div>
            </div>
        </section>
    );
};

export default TechTourIntro;
