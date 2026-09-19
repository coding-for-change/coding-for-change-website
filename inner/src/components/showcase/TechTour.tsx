'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { useCmsGlobal } from '../../api';
import type { CmsTechTour } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';
import TechTourLineup from './TechTourLineup';
import TechTourExplore, { eventAnchor } from './TechTourExplore';
import useDarkNav from '../../hooks/useDarkNav';
import { formatDateRange, techTourRegistrationOpen } from '../../lib/techTour';
import './landing.css';

export interface TechTourProps {
    techTour?: CmsTechTour | null;
    /** Request time from the server component; see BecomeAMember for why. */
    serverNow?: number;
}

/** Stroke icons for the three facts. 24×24, inheriting colour and stroke. */
const IconFormat = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3 21h18M5 21V8l7-5 7 5v13" />
        <path d="M9.5 21v-5h5v5" />
        <path d="M9 11h1.5M13.5 11H15" />
    </svg>
);
const IconDates = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="3" y="5" width="18" height="16" rx="2.5" />
        <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
);
const IconDeadline = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4.5l3 2M9 2h6" />
    </svg>
);

/**
 * The Munich TechTour page: a week of evening visits to Munich tech companies,
 * open to every student.
 *
 * A poster, not an article. On a desktop viewport it is exactly one screen —
 * title, three facts, the line-up, one button — and the shell's scrolling is
 * switched off underneath it (see `.lp--tt-poster` in landing.css). Everything
 * that does not belong on a poster (times, locations, what you get, the
 * attendance commitment) lives on /techtour/apply behind the button, together
 * with the registration form: a form at the foot of a long read is a comment
 * box under a newspaper article. A narrow screen cannot hold a poster, so
 * there it becomes an ordinary scrolling page of the same parts.
 */
const TechTour: React.FC<TechTourProps> = (props) => {
    const { t, locale } = useLanguage();
    const { data: tt } = useCmsGlobal<CmsTechTour>('tech-tour', props.techTour);

    const [now, setNow] = useState(() => props.serverNow ?? Date.now());
    useEffect(() => {
        setNow(Date.now());
    }, []);

    const open = techTourRegistrationOpen(tt, now);
    const dateLocale = locale === 'de' ? 'de-DE' : 'en-GB';

    const events = useMemo(
        () =>
            [...(tt?.events ?? [])].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            ),
        [tt]
    );

    // The poster's headline is the event's name; the CMS `title` is a
    // strapline, far too long to set at poster size.
    const title = t.techtour.posterTitle;

    // The stage is dark from top to bottom, so the nav is told to use its
    // light ink and go transparent over it.
    useDarkNav();

    // The line-up tiles and the "Learn more" button both scroll down into the
    // Explore section. On desktop the site scrolls inside `.site-scroll`, on
    // mobile the window does — scrollIntoView finds the right one either way,
    // and the targets carry a scroll-margin so the fixed nav does not land on
    // them.
    const scrollTo = useCallback((id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);
    // The scroll hint flashes once, when the line has finished drawing.
    const [drawn, setDrawn] = useState(false);
    const onDone = useCallback(() => setDrawn(true), []);

    // Every time the line reaches an icon the poster takes a knock. The shake
    // rides on the content column rather than on the black behind it: moving
    // the background too would show a sliver of whatever is underneath at the
    // edge of the screen.
    const reduced = useReducedMotion();
    const shakeX = useMotionValue(0);
    const shakeY = useMotionValue(0);
    const onHit = useCallback(() => {
        if (reduced) return;
        animate(shakeX, [0, -2.8, 2, -1.2, 0.5, 0], { duration: 0.42, ease: 'easeOut' });
        animate(shakeY, [0, 1.6, -2, 1, -0.4, 0], { duration: 0.42, ease: 'easeOut' });
    }, [reduced, shakeX, shakeY]);

    // The three facts: what it is, when it runs, by when to sign up. All of it
    // comes from the events and the deadline already in the CMS, so there is
    // nothing extra to keep in step.
    const facts = useMemo(() => {
        const out: { icon: React.ReactNode; label: string; value: string }[] = [];
        if (events.length > 0) {
            out.push({
                icon: <IconFormat />,
                label: t.techtour.factFormatLabel,
                value: t.techtour.factEvenings.replace('{count}', String(events.length)),
            });
        }
        const dates = events
            .map((ev) => new Date(ev.date))
            .filter((d) => !Number.isNaN(d.getTime()));
        if (dates.length > 0) {
            out.push({
                icon: <IconDates />,
                label: t.techtour.factDatesLabel,
                value: formatDateRange(dates[0], dates[dates.length - 1], dateLocale),
            });
        }
        const deadline = tt?.registrationDeadline ? new Date(tt.registrationDeadline) : null;
        if (deadline && !Number.isNaN(deadline.getTime())) {
            out.push({
                icon: <IconDeadline />,
                label: t.techtour.factDeadlineLabel,
                value: deadline.toLocaleDateString(dateLocale, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                }),
            });
        }
        return out;
    }, [events, dateLocale, tt, t]);

    return (
        <div className="lp lp--techtour">
            <section className="lp-tt-poster">
            <motion.div className="lp-tt-poster__inner" style={{ x: shakeX, y: shakeY }}>
                <div className="lp-tt-poster__head">
                <motion.h1
                    className="lp-tt-poster__title"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55 }}
                >
                    {title}
                </motion.h1>

                {facts.length > 0 && (
                    <motion.ul
                        className="lp-tt-facts"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.12 }}
                    >
                        {facts.map((fact) => (
                            <li className="lp-tt-fact" key={fact.label}>
                                <span className="lp-tt-fact__icon">{fact.icon}</span>
                                <span className="lp-tt-fact__body">
                                    <span className="lp-tt-fact__label">{fact.label}</span>
                                    <span className="lp-tt-fact__value">{fact.value}</span>
                                </span>
                            </li>
                        ))}
                    </motion.ul>
                )}
                </div>

                {events.length > 0 && (
                    <TechTourLineup
                        events={events}
                        tbaLabel={t.techtour.tbaCompany}
                        hint={t.techtour.tileHint}
                        onHit={onHit}
                        onDone={onDone}
                        onPick={(i) => scrollTo(eventAnchor(i))}
                    />
                )}

                <motion.div
                    className="lp-tt-poster__cta"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                >
                    {open ? (
                        <span className="lp-tt-poster__btns">
                            {events.length > 0 && (
                                <button
                                    type="button"
                                    className="lp-btn lp-btn--wire"
                                    onClick={() => scrollTo('tt-explore')}
                                >
                                    {t.techtour.learnMoreCta} ↓
                                </button>
                            )}
                            <Link className="lp-btn lp-btn--glow" href="/techtour/apply">
                                {t.techtour.applyCta} →
                            </Link>
                        </span>
                    ) : (
                        <>
                            <p className="lp-tt-poster__closed">
                                {tt?.closedMessage || t.techtour.closedFallback}
                            </p>
                            <Link className="lp-btn lp-btn--wire" href="/techtour/apply">
                                {t.techtour.detailsCta} →
                            </Link>
                        </>
                    )}
                </motion.div>

            </motion.div>

            {events.length > 0 && (
                <button
                    type="button"
                    /* Quiet by default; it catches the eye once, the moment the
                       line has finished drawing and there is nothing else left
                       to watch. */
                    className={`lp-tt-scroll-hint${drawn ? ' is-flashing' : ''}`}
                    onClick={() => scrollTo('tt-explore')}
                >
                    {t.techtour.scrollHint}
                    <span className="lp-tt-scroll-hint__arrow" aria-hidden="true">
                        ↓
                    </span>
                </button>
            )}
            </section>

            {events.length > 0 && <TechTourExplore events={events} open={open} />}
        </div>
    );
};

export default TechTour;
