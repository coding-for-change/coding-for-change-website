'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCmsGlobal } from '../../api';
import type {
    CmsMembership,
    CmsProject,
    CmsSponsor,
    CmsTeamMember,
    CmsTechTour,
} from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import {
    APPLICATION_ROUND,
    applicationStatus,
    daysUntilDeadline,
    daysUntilOpening,
} from '../../lib/applicationPhase';
import JoinHeroSlides from './JoinHeroSlides';
import JoinExpect from './JoinExpect';
import JoinWays from './JoinWays';
import JoinProcess from './JoinProcess';
import PartnerMarquee, { joinPartners } from './PartnerMarquee';
import './landing.css';
import './join.css';

const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
} as const;

/**
 * The slideshow in the head: a photo from each kind of event, with the
 * event's cover image where it had one. Captions live in the translations
 * (`join.slides`), keyed by id.
 */
const HERO_SLIDES = [
    {
        id: 'marioKart',
        photo: '/images/community/crowd.webp',
        position: '55% 40%',
        poster: '/images/join/poster-mario-kart.webp',
    },
    { id: 'hackathon', photo: '/images/join/community-events.webp', position: '50% 62%' },
    {
        id: 'changemakerChat',
        photo: '/images/join/changemaker-chat.webp',
        position: '50% 72%',
        poster: '/images/join/poster-changemaker-chat.webp',
    },
] as const;

export interface BecomeAMemberProps {
    /** Title and lead of the head; everything else on the page is copy in the translations. */
    membership?: CmsMembership | null;
    /** NGO partners for the logo band, and the showcase beside the steps. */
    projects?: CmsProject[] | null;
    /** Company partners for the logo band. */
    sponsors?: CmsSponsor[] | null;
    /** TechTour hosts join the band once that page is listed. */
    techTour?: CmsTechTour | null;
    /** The members named on the "ways in" cards, for the "want to know more?" footers. */
    team?: CmsTeamMember[] | null;
    /**
     * Request time from the server component. Seeding the clock with it keeps
     * the server and first client render identical (no hydration mismatch on
     * the round's status or the day count); the client clock takes over after
     * mount.
     */
    serverNow?: number;
}

/**
 * /join makes the case; /join/apply takes the application. Top to bottom:
 * the head (the pitch, a slideshow of our events, and a chip saying when the
 * round opens or closes), the partners sliding past, what a semester with us
 * holds, the two ways in, the three steps of the application beside a project
 * members built, and a closing band. The three middle sections are shared
 * with the homepage's student mode (JoinExpect, JoinWays, JoinProcess).
 * Every button leads to /join/apply, which shows the form while the round is
 * open and the "notify me" signup around it.
 */
const BecomeAMember: React.FC<BecomeAMemberProps> = (props) => {
    const { t, locale } = useLanguage();
    const { data: membership } = useCmsGlobal<CmsMembership>('membership', props.membership);

    const [now, setNow] = useState(() => props.serverNow ?? Date.now());
    useEffect(() => {
        setNow(Date.now());
    }, []);
    const status = applicationStatus(now);
    const round = APPLICATION_ROUND[locale];

    const partners = useMemo(
        () => joinPartners(props.projects, props.sponsors, props.techTour),
        [props.projects, props.sponsors, props.techTour]
    );

    // The line under "Opens 5 Oct" / "Closes 30 Oct", or none: a deadline
    // pushed past its date (APPLICATIONS_OVERRIDE) has no day to count to.
    const c = t.join.countdown;
    const countdown = (() => {
        if (status === 'upcoming') {
            const n = daysUntilOpening(now);
            return n === 1 ? c.opensIn.one : c.opensIn.other.replace('{n}', String(n));
        }
        if (status === 'open') {
            const n = daysUntilDeadline(now);
            if (n === 0) return null;
            return n === 1 ? c.closesIn.one : c.closesIn.other.replace('{n}', String(n));
        }
        return null;
    })();

    const scrollToProcess = (e: React.MouseEvent) => {
        const el = document.getElementById('process');
        if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="lp jn">
            <section className="jn-hero">
                <div className="lp-inner jn-hero__inner">
                    <motion.div
                        className="jn-hero__copy"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <p className="lp-kicker">
                            {t.nav.join} · {round}
                        </p>
                        <h1 className="jn-hero__title">{membership?.title || t.join.title}</h1>
                        <p className="jn-hero__lead">{membership?.description || t.join.lead}</p>
                        <div className="jn-hero__ctas">
                            <Link className="lp-btn lp-btn--primary" href="/join/apply">
                                {t.join.cta[status]} →
                            </Link>
                            <a
                                className="lp-btn lp-btn--ghost"
                                href="#process"
                                onClick={scrollToProcess}
                            >
                                {t.join.howItWorks} ↓
                            </a>
                        </div>
                    </motion.div>

                    <motion.div
                        className="jn-hero__visual"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                    >
                        <span className="jn-hero__backdrop" aria-hidden="true" />
                        <JoinHeroSlides
                            label={t.join.slides.label}
                            goTo={t.join.slides.goTo}
                            slides={HERO_SLIDES.map((slide) => {
                                const copy = t.join.slides.items[slide.id];
                                return { ...slide, ...copy };
                            })}
                        >
                            <div className="jn-hero__chip" data-status={status}>
                                <span className="jn-hero__dot" aria-hidden="true" />
                                <span className="jn-hero__chip-body">
                                    <span className="jn-hero__chip-status">
                                        {t.join.status[status]}
                                    </span>
                                    {countdown && (
                                        <span className="jn-hero__chip-count">{countdown}</span>
                                    )}
                                </span>
                            </div>
                        </JoinHeroSlides>
                    </motion.div>
                </div>
            </section>

            <PartnerMarquee partners={partners} label={t.join.partnersLabel} />

            <section className="lp-section jn-expect">
                <JoinExpect />
            </section>

            <section className="lp-section lp-section--alt jn-ways">
                <JoinWays team={props.team} />
            </section>

            <section className="lp-section jn-process" id="process">
                <JoinProcess now={now} projects={props.projects} />
            </section>

            <section className="lp-cta jn-closing">
                <div className="lp-inner">
                    <motion.div style={{ display: 'block' }} {...reveal} transition={{ duration: 0.5 }}>
                        <h2 className="lp-cta__heading">{t.join.closing.heading}</h2>
                        <p className="lp-cta__text">{t.join.closing.text[status]}</p>
                        <div className="lp-cta__btns">
                            <Link className="lp-btn lp-btn--light" href="/join/apply">
                                {t.join.cta[status]} →
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    );
};

export default BecomeAMember;
