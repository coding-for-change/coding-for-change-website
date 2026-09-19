'use client';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { mediaUrl } from '../../api';
import type { CmsTechTourEvent } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * What the poster leaves out: one panel per evening, picture on the left and
 * everything known about the visit on the right. It is the other half of the
 * line-up above — each panel carries the id its tile scrolls to, and the
 * `scroll-margin-top` in landing.css is what keeps the fixed nav from landing
 * on the heading.
 */

/** The anchor a line-up tile scrolls to. Shared with TechTour.tsx. */
export const eventAnchor = (index: number): string => `tt-evening-${index}`;

const reveal = {
    initial: { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
} as const;

export interface TechTourExploreProps {
    events: CmsTechTourEvent[];
    /** Registration is open — otherwise the per-evening apply link is pointless. */
    open: boolean;
}

const TechTourExplore: React.FC<TechTourExploreProps> = ({ events, open }) => {
    const { t, locale } = useLanguage();
    const dateLocale = locale === 'de' ? 'de-DE' : 'en-GB';

    return (
        <section className="lp-tt-explore" id="tt-explore">
            <div className="lp-inner lp-inner--wide">
                <motion.div className="lp-tt-explore__head" {...reveal} transition={{ duration: 0.5 }}>
                    <p className="lp-kicker">{t.techtour.exploreKicker}</p>
                    <h2 className="lp-tt-explore__heading">{t.techtour.exploreHeading}</h2>
                    <p className="lp-lead">{t.techtour.exploreLead}</p>
                </motion.div>

                <ol className="lp-tt-evenings">
                    {events.map((ev, i) => {
                        const tba = ev.status === 'tba';
                        const company = tba ? t.techtour.tbaCompany : ev.company;
                        const image = mediaUrl(ev.image);
                        const logo = mediaUrl(ev.logo);
                        const date = new Date(ev.date);
                        return (
                            <motion.li
                                className={`lp-tt-evening${tba ? ' is-tba' : ''}`}
                                id={eventAnchor(i)}
                                key={ev.id ?? i}
                                {...reveal}
                                transition={{ duration: 0.5 }}
                            >
                                <div className="lp-tt-evening__art">
                                    {image ? (
                                        <img src={image} alt="" loading="lazy" />
                                    ) : (
                                        // No photo yet: the logo on the panel
                                        // reads as deliberate, a broken frame
                                        // does not.
                                        <span className="lp-tt-evening__fallback">
                                            {logo && !tba ? (
                                                <img src={logo} alt="" loading="lazy" />
                                            ) : (
                                                <span aria-hidden="true">?</span>
                                            )}
                                        </span>
                                    )}
                                </div>

                                <div className="lp-tt-evening__body">
                                    <p className="lp-tt-evening__when">
                                        <span className="lp-tt-evening__day">
                                            {date.toLocaleDateString(dateLocale, {
                                                weekday: 'long',
                                            })}
                                        </span>
                                        <span className="lp-tt-evening__date">
                                            {date.toLocaleDateString(dateLocale, {
                                                day: 'numeric',
                                                month: 'long',
                                            })}
                                        </span>
                                        {ev.status === 'tentative' && (
                                            <span className="lp-tt-evening__badge">
                                                {t.techtour.tentative}
                                            </span>
                                        )}
                                    </p>
                                    <h3 className="lp-tt-evening__title">
                                        {ev.title && !tba ? ev.title : company}
                                    </h3>
                                    {ev.title && !tba && (
                                        <p className="lp-tt-evening__host">{company}</p>
                                    )}
                                    <dl className="lp-tt-evening__facts">
                                        <div>
                                            <dt>{t.techtour.factTimeLabel}</dt>
                                            <dd>{ev.time || t.techtour.tbaTime}</dd>
                                        </div>
                                        <div>
                                            <dt>{t.techtour.factPlaceLabel}</dt>
                                            <dd>{ev.location || t.techtour.tbaLocation}</dd>
                                        </div>
                                    </dl>
                                    {ev.description && (
                                        <p className="lp-tt-evening__text">{ev.description}</p>
                                    )}
                                    <p className="lp-tt-evening__actions">
                                        {open && (
                                            <Link
                                                className="lp-btn lp-btn--quiet"
                                                href="/techtour/apply"
                                            >
                                                {t.techtour.eventApplyCta} →
                                            </Link>
                                        )}
                                        {ev.website && !tba && (
                                            <a
                                                className="lp-tt-evening__site"
                                                href={ev.website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {t.techtour.eventSiteCta} ↗
                                            </a>
                                        )}
                                    </p>
                                </div>
                            </motion.li>
                        );
                    })}
                </ol>
            </div>
        </section>
    );
};

export default TechTourExplore;
