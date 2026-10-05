'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { mediaUrl, useCmsGlobal } from '../../api';
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
import { hasCaseStudy } from '../../lib/projects';
import { LinkedInMark } from '../general/SocialMarks';
import JoinHeroSlides from './JoinHeroSlides';
import JoinSteps from './JoinSteps';
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

/** The three things a semester with us is made of, each with its photo. */
const EXPECT = [
    { id: 'projects', src: '/images/join/project-work.webp' },
    { id: 'community', src: '/images/join/community-events.webp' },
    { id: 'companies', src: '/images/join/company-visits.webp' },
] as const;

/**
 * The two ways in, each with the member to ask about it – by name as it
 * appears on the Team page, which supplies the photo and the LinkedIn link.
 * A name the Team page doesn't have simply drops the card's footer. `crop`
 * zooms their current Team photo so the face sits centred and at the same
 * size in both circles; revisit it when a photo changes.
 */
const WAYS = [
    { id: 'projects', contact: 'Jakob', crop: { scale: 1.72, origin: '54% 13%' } },
    { id: 'taskForce', contact: 'David', crop: { scale: 1.5, origin: '46% 49%' } },
] as const;

const findMember = (team: CmsTeamMember[] | null | undefined, name: string) =>
    (team ?? []).find((m) => m.name.trim().toLowerCase() === name.toLowerCase()) ?? null;

/**
 * The project shown beside the steps: its screens on a laptop and a phone
 * (a still made from the case study's gallery) and a link to the case study.
 * Title, partner and impact line come from the CMS in the visitor's language;
 * without the project – or without a case study to link to – the steps run
 * on their own.
 */
const SHOWCASE_SLUG = 'lebenshilfe';
const SHOWCASE_IMAGE = '/images/join/lebenshilfe-showcase.webp';

const linkedInOf = (member: CmsTeamMember) =>
    member.links
        ?.find((l) => l.label.trim().toLowerCase() === 'linkedin' || /linkedin\.com/i.test(l.url))
        ?.url.trim() ?? null;

export interface BecomeAMemberProps {
    /** Title and lead of the head; everything else on the page is copy in the translations. */
    membership?: CmsMembership | null;
    /** NGO partners for the logo band. */
    projects?: CmsProject[] | null;
    /** Company partners for the logo band. */
    sponsors?: CmsSponsor[] | null;
    /** TechTour hosts join the band once that page is listed. */
    techTour?: CmsTechTour | null;
    /** The members named in WAYS, for the "want to know more?" footers. */
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
 * round opens or closes), the partners sliding past, what a semester with us holds, the two
 * ways in, the three steps of the application beside a project members built,
 * and a closing band. Every button leads to /join/apply, which shows the form
 * while the round is open and the "notify me" signup around it.
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
    const showcase = useMemo(
        () =>
            (props.projects ?? []).find((p) => p.slug === SHOWCASE_SLUG && hasCaseStudy(p)) ??
            null,
        [props.projects]
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
                <div className="lp-inner">
                    <motion.div className="jn-head" {...reveal} transition={{ duration: 0.5 }}>
                        <p className="lp-kicker">{t.join.expect.kicker}</p>
                        <h2 className="lp-h2">{t.join.expect.heading}</h2>
                        <p className="lp-lead">{t.join.expect.lead}</p>
                    </motion.div>
                    <div className="jn-bento">
                        {EXPECT.map((item, i) => {
                            const copy = t.join.expect.items[item.id];
                            return (
                                <motion.figure
                                    key={item.id}
                                    className={`jn-tile jn-tile--${item.id}`}
                                    {...reveal}
                                    transition={{ duration: 0.5, delay: i * 0.08 }}
                                >
                                    <img
                                        className="jn-tile__img"
                                        src={item.src}
                                        alt={copy.alt}
                                        loading="lazy"
                                        decoding="async"
                                    />
                                    <figcaption className="jn-tile__body">
                                        <h3 className="jn-tile__title">{copy.title}</h3>
                                        <p className="jn-tile__text">{copy.text}</p>
                                    </figcaption>
                                </motion.figure>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="lp-section lp-section--alt jn-ways">
                <div className="lp-inner">
                    <motion.div className="jn-head" {...reveal} transition={{ duration: 0.5 }}>
                        <p className="lp-kicker">{t.join.ways.kicker}</p>
                        <h2 className="lp-h2">{t.join.ways.heading}</h2>
                    </motion.div>
                    <div className="jn-ways__grid">
                        {WAYS.map((way, i) => {
                            const copy = t.join.ways.items[way.id];
                            const member = findMember(props.team, way.contact);
                            const linkedIn = member ? linkedInOf(member) : null;
                            const photo = member ? mediaUrl(member.image) : null;
                            return (
                                <motion.article
                                    key={way.id}
                                    className="jn-way"
                                    {...reveal}
                                    transition={{ duration: 0.5, delay: i * 0.08 }}
                                >
                                    <p className="jn-way__label">{copy.label}</p>
                                    <h3 className="jn-way__title">{copy.title}</h3>
                                    <p className="jn-way__text">{copy.text}</p>
                                    <ul className="jn-way__points">
                                        {copy.points.map((point) => (
                                            <li key={point}>{point}</li>
                                        ))}
                                    </ul>
                                    {member && linkedIn && (
                                        <a
                                            className="jn-way__contact"
                                            href={linkedIn}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={t.join.ways.contactLink.replace(
                                                '{name}',
                                                member.name
                                            )}
                                        >
                                            <span className="jn-way__avatar" aria-hidden="true">
                                                {photo ? (
                                                    <img
                                                        src={photo}
                                                        alt=""
                                                        loading="lazy"
                                                        decoding="async"
                                                        style={{
                                                            transform: `scale(${way.crop.scale})`,
                                                            transformOrigin: way.crop.origin,
                                                        }}
                                                    />
                                                ) : (
                                                    member.name.charAt(0)
                                                )}
                                            </span>
                                            <span className="jn-way__person">
                                                <span className="jn-way__person-label">
                                                    {t.join.ways.contactLabel}
                                                </span>
                                                <span className="jn-way__person-name">
                                                    {member.name}
                                                    {member.role && (
                                                        <span className="jn-way__person-role">
                                                            {' '}
                                                            · {member.role}
                                                        </span>
                                                    )}
                                                </span>
                                            </span>
                                            <span className="jn-way__linkedin" aria-hidden="true">
                                                <LinkedInMark />
                                            </span>
                                        </a>
                                    )}
                                </motion.article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="lp-section jn-process" id="process">
                <div className="lp-inner">
                    <motion.div className="jn-head" {...reveal} transition={{ duration: 0.5 }}>
                        <p className="lp-kicker">
                            {t.join.process.kicker} · {round}
                        </p>
                        <h2 className="lp-h2">{t.join.process.heading}</h2>
                    </motion.div>
                    <div className={`jn-process__grid${showcase ? '' : ' jn-process__grid--solo'}`}>
                        <JoinSteps now={now} />
                        {showcase && (
                            <motion.figure
                                className="jn-showcase"
                                {...reveal}
                                transition={{ duration: 0.55, delay: 0.1 }}
                            >
                                <img
                                    className="jn-showcase__img"
                                    src={SHOWCASE_IMAGE}
                                    alt={t.join.showcase.alt.replace('{title}', showcase.title)}
                                    width={1040}
                                    height={720}
                                    loading="lazy"
                                    decoding="async"
                                />
                                <figcaption className="jn-showcase__body">
                                    <p className="jn-showcase__kicker">{t.join.showcase.kicker}</p>
                                    <h3 className="jn-showcase__title">{showcase.title}</h3>
                                    <p className="jn-showcase__ngo">
                                        {t.join.showcase.forNgo.replace('{ngo}', showcase.ngoPartner)}
                                    </p>
                                    {showcase.impactHeadline && (
                                        <p className="jn-showcase__text">{showcase.impactHeadline}</p>
                                    )}
                                    <Link
                                        className="jn-showcase__link"
                                        href={`/projects/${showcase.slug}`}
                                    >
                                        {t.join.showcase.link} →
                                    </Link>
                                </figcaption>
                            </motion.figure>
                        )}
                    </div>
                </div>
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
