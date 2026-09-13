'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useCmsCollection, useCmsGlobal, useSiteConfig } from '../../api';
import {
    CmsEvent,
    CmsProject,
    CmsSponsor,
    CmsFaqItem,
    CmsHomepage,
} from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import BookingEmbed from '../general/BookingEmbed';
import ProcessTimeline, { buildProcessSteps } from './ProcessTimeline';
import ProjectShowcase from './ProjectShowcase';
import ScrollRevealText from './ScrollRevealText';
import SponsorTiers from './SponsorTiers';
import ClosingCta from './ClosingCta';
import useSectionBackgrounds from '../../hooks/useSectionBackgrounds';
import './landing.css';

// Shared scroll-reveal animation. Sections fade/slide in once on first view.
const reveal = {
    initial: { opacity: 0, y: 26 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
} as const;

export interface LandingProps {
    events?: CmsEvent[] | null;
    projects?: CmsProject[] | null;
    sponsors?: CmsSponsor[] | null;
    faq?: CmsFaqItem[] | null;
    homepage?: CmsHomepage | null;
}

const Landing: React.FC<LandingProps> = (props) => {
    const siteConfig = useSiteConfig();
    const { t } = useLanguage();
    const pathname = usePathname();
    const router = useRouter();

    // True when running inside the 3D scene's monitor iframe — resolved after
    // mount to avoid a hydration mismatch (window.top is unreadable server-side).
    const [embedded, setEmbedded] = useState(false);
    useEffect(() => {
        try {
            setEmbedded(window.self !== window.top);
        } catch {
            setEmbedded(true);
        }
    }, []);
    const exitThreeD = () => {
        try {
            if (window.top) {
                window.top.location.href = window.location.pathname || '/';
                return;
            }
        } catch {
            /* cross-origin parent — fall through */
        }
        window.location.href = '/';
    };

    const { data: events } = useCmsCollection<CmsEvent>(
        'events',
        undefined,
        props.events
    );
    const { data: projects, loading: projectsLoading } =
        useCmsCollection<CmsProject>('projects', undefined, props.projects);
    const { data: sponsors, loading: sponsorsLoading } =
        useCmsCollection<CmsSponsor>('sponsors', { depth: '1' }, props.sponsors);
    const { data: faq, loading: faqLoading } =
        useCmsCollection<CmsFaqItem>('faq', undefined, props.faq);
    const { data: hp } = useCmsGlobal<CmsHomepage>('homepage', props.homepage);

    // Homepage copy: CMS value if set, else the built-in i18n string.
    const c = {
        heroCtaPrimary: hp?.heroCtaPrimary || t.home.ctaPrimary,
        heroCtaSecondary: hp?.heroCtaSecondary || t.home.ctaSecondary,
        heroScrollHint: hp?.heroScrollHint || t.home.scrollHint,
        aboutKicker: hp?.aboutKicker || t.about.kicker,
        aboutOneLiner: hp?.aboutOneLiner || t.about.oneLiner,
        aboutPitch: hp?.aboutPitch || t.about.pitch,
        processKicker: hp?.processKicker || t.process.kicker,
        processHeading: hp?.processHeading || t.process.heading,
        processIntro: hp?.processIntro || t.process.intro,
        projectsSubtitle: hp?.projectsSubtitle || t.projects.subtitle,
        projectsTitle: hp?.projectsTitle || t.projects.title,
        projectsIntro: hp?.projectsIntro || t.projects.intro,
        eventsSubtitle: hp?.eventsSubtitle || t.events.subtitle,
        eventsTitle: hp?.eventsTitle || t.events.title,
        eventsIntro: hp?.eventsIntro || t.events.intro,
        sponsorsSubtitle: hp?.sponsorsSubtitle || t.sponsors.subtitle,
        sponsorsTitle: hp?.sponsorsTitle || t.sponsors.title,
        sponsorsIntro: hp?.sponsorsIntro || t.sponsors.intro,
        qaSubtitle: hp?.qaSubtitle || t.qa.subtitle,
        qaTitle: hp?.qaTitle || t.qa.title,
        qaIntro: hp?.qaIntro || t.qa.intro,
        threedKicker: hp?.threedKicker || t.threed.kicker,
        threedTitle: hp?.threedTitle || t.threed.title,
        threedText: hp?.threedText || t.threed.text,
        threedCta: hp?.threedCta || t.threed.cta,
        ctaHeading: hp?.ctaHeading || t.cta.heading,
        ctaText: hp?.ctaText || t.cta.text,
        ctaJoin: hp?.ctaJoin || t.cta.join,
        ctaContact: hp?.ctaContact || t.cta.contact,
    };
    // Process timeline: CMS steps override the built-in ones; a CMS step's
    // button defaults to this page's booking section.
    const processSteps = buildProcessSteps(hp?.steps, t.process.steps, '#book');

    const [openFaq, setOpenFaq] = useState<number | null>(null);


    // Scroll-driven background blend between the `data-bg` bands + nav ink flip.
    const bgRef = useRef<HTMLDivElement>(null);
    useSectionBackgrounds(bgRef);


    const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        const scrollToHash = () => {
            if (scrollTimer.current) clearTimeout(scrollTimer.current);
            const id = window.location.hash.replace('#', '');
            if (!id) {
                document.getElementById('home')?.scrollIntoView({ block: 'start' });
                return;
            }
            const scroll = () =>
                document
                    .getElementById(id)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            scroll();
            scrollTimer.current = setTimeout(scroll, 350);
        };
        scrollToHash();
        window.addEventListener('hashchange', scrollToHash);
        return () => {
            window.removeEventListener('hashchange', scrollToHash);
            if (scrollTimer.current) clearTimeout(scrollTimer.current);
        };
    }, [pathname]);

    // Events are only shown when the collection has content (the /events page
    // exists regardless). Split into upcoming / past for the homepage teaser.
    const upcoming = (events ?? []).filter((e) => e.isUpcoming);
    const past = (events ?? []).filter((e) => !e.isUpcoming);
    const hasEvents = (events?.length ?? 0) > 0;
    const hasSponsors = (sponsors?.length ?? 0) > 0;

    const renderEventCard = (event: CmsEvent, i: number) => (
        <motion.div
            key={event.id}
            className="lp-card"
            {...reveal}
            transition={{ duration: 0.45, delay: Math.min(i * 0.05, 0.3) }}
        >
            <span className="lp-badge">{event.type}</span>
            <h3 className="lp-card__title">{event.title}</h3>
            <span className="lp-card__meta">
                {event.date} {t.common.at} {event.time}
            </span>
            <span className="lp-card__sub">{event.location}</span>
            <p className="lp-card__text">{event.description}</p>
            {event.link?.url && (
                <a
                    className="lp-card__link"
                    href={event.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {event.link.label || t.common.learnMore} →
                </a>
            )}
        </motion.div>
    );

    return (
        <div className="lp lp--landing" ref={bgRef}>
            {/* ---- Hero: copy left, photo collage over a navy panel right ---- */}
            <section id="home" className="lp-hero">
                <div className="lp-hero__inner">
                    <motion.div
                        className="lp-hero__copy"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, ease: 'easeOut' }}
                    >
                        <p className="lp-hero__kicker">{t.home.heroLineOne}</p>
                        <h1 className="lp-hero__title">{t.home.heroLineTwo}</h1>
                        <p className="lp-hero__lead">
                            {siteConfig.tagline || t.about.oneLiner}
                        </p>
                        <div className="lp-hero__ctas">
                            <Link className="lp-btn lp-btn--primary" href="/join">
                                {c.heroCtaPrimary}
                            </Link>
                            <a
                                className="lp-btn lp-btn--ghost"
                                href="#projects"
                                onClick={(e) => {
                                    e.preventDefault();
                                    router.push('/#projects');
                                }}
                            >
                                {c.heroCtaSecondary}
                            </a>
                        </div>
                    </motion.div>
                    <div className="lp-hero__visual">
                        <motion.div
                            className="lp-hero__panel"
                            aria-hidden="true"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.6 }}
                        >
                            <img
                                className="lp-hero__glyph"
                                src="/images/logo-mark.svg"
                                alt=""
                                draggable={false}
                            />
                        </motion.div>
                        {[
                            {
                                cls: 'lp-hero__ph lp-hero__ph--a',
                                src: '/images/community/talk.webp',
                                alt: 'Coding for Change members presenting the club to a full room',
                            },
                            {
                                cls: 'lp-hero__ph lp-hero__ph--b',
                                src: '/images/community/meeting.webp',
                                alt: 'Coding for Change members in a project workshop with an NGO partner',
                            },
                            {
                                cls: 'lp-hero__ph lp-hero__ph--c',
                                src: '/images/community/crowd.webp',
                                alt: 'Guests at a Coding for Change community event',
                            },
                        ].map((ph, i) => (
                            <motion.img
                                key={ph.src}
                                className={ph.cls}
                                src={ph.src}
                                alt={ph.alt}
                                draggable={false}
                                initial={{ opacity: 0, y: 28 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    duration: 0.55,
                                    delay: 0.15 + i * 0.14,
                                    ease: 'easeOut',
                                }}
                            />
                        ))}
                    </div>
                </div>
                <span className="lp-hero__hint">{c.heroScrollHint}</span>
            </section>

            {/* ---- About — pure-text statement with word-by-word reveal ---- */}
            <section id="about" data-bg="#ffffff" className="lp-section">
                <div className="lp-inner">
                    <motion.p
                        className="lp-kicker"
                        {...reveal}
                        transition={{ duration: 0.5 }}
                    >
                        {c.aboutKicker}
                    </motion.p>
                    <ScrollRevealText
                        as="h2"
                        text={c.aboutOneLiner}
                        className="lp-about-statement"
                    />
                    <ScrollRevealText
                        as="p"
                        text={c.aboutPitch}
                        className="lp-lead lp-about-statement__sub"
                        end={0.75}
                    />
                </div>
            </section>

            {/* ---- Process: how we work with NGOs ---- */}
            <section
                id="process"
                data-bg="#0f2040"
                className="lp-section lp-section--dark"
            >
                <div className="lp-inner">
                    <motion.div
                        style={{ display: 'block' }}
                        {...reveal}
                        transition={{ duration: 0.5 }}
                    >
                        <p className="lp-kicker">{c.processKicker}</p>
                        <h2 className="lp-h2">{c.processHeading}</h2>
                        <p className="lp-lead">{c.processIntro}</p>
                    </motion.div>
                    <ProcessTimeline steps={processSteps} />
                </div>
            </section>

            {/* ---- Projects ---- */}
            <section id="projects" data-bg="#ffffff" className="lp-section">
                <div className="lp-inner">
                    <motion.div
                        style={{ display: 'block' }}
                        {...reveal}
                        transition={{ duration: 0.5 }}
                    >
                        <p className="lp-kicker">{c.projectsSubtitle}</p>
                        <h2 className="lp-h2">{c.projectsTitle}</h2>
                        <p className="lp-lead">{c.projectsIntro}</p>
                    </motion.div>
                    {projectsLoading ? (
                        <p className="lp-loading">Loading…</p>
                    ) : (
                        <ProjectShowcase projects={projects ?? []} />
                    )}
                    <div className="lp-section__more">
                        <Link className="lp-btn lp-btn--ghost" href="/projects">
                            {t.projects.viewAll} →
                        </Link>
                    </div>
                </div>
            </section>

            {/* ---- Events (homepage teaser; only shown when events exist) ---- */}
            {hasEvents && (
                <section
                    id="events"
                    data-bg="#f1f6f6"
                    className="lp-section lp-section--alt"
                >
                    <div className="lp-inner">
                        <motion.div style={{ display: 'block' }} {...reveal} transition={{ duration: 0.5 }}>
                            <p className="lp-kicker">{c.eventsSubtitle}</p>
                            <h2 className="lp-h2">{c.eventsTitle}</h2>
                            <p className="lp-lead">{c.eventsIntro}</p>
                        </motion.div>
                        {upcoming.length > 0 && (
                            <>
                                <h3 className="lp-subhead">{t.events.upcoming}</h3>
                                <div className="lp-grid">{upcoming.map(renderEventCard)}</div>
                            </>
                        )}
                        {past.length > 0 && (
                            <>
                                <h3 className="lp-subhead">{t.events.past}</h3>
                                <div className="lp-grid">{past.map(renderEventCard)}</div>
                            </>
                        )}
                        <div className="lp-section__more">
                            <Link className="lp-btn lp-btn--ghost" href="/events">
                                {c.eventsTitle} →
                            </Link>
                        </div>
                    </div>
                </section>
            )}

            {/* ---- 3D experience (hidden on mobile). Inside the 3D scene it
                 flips to a "back to the standard site" prompt. ---- */}
            <section className="lp-3d" data-bg="#0f2040">
                <div className="lp-inner">
                    <motion.div
                        style={{ display: 'block' }}
                        {...reveal}
                        transition={{ duration: 0.5 }}
                    >
                        <p className="lp-kicker lp-3d__kicker">
                            {embedded ? t.threed.backKicker : c.threedKicker}
                        </p>
                        <h2 className="lp-3d__title">
                            {embedded ? t.threed.backTitle : c.threedTitle}
                        </h2>
                        <p className="lp-3d__text">
                            {embedded ? t.threed.backText : c.threedText}
                        </p>
                        {embedded ? (
                            <button
                                type="button"
                                className="lp-btn lp-btn--light"
                                onClick={exitThreeD}
                            >
                                {t.threed.backCta} →
                            </button>
                        ) : (
                            <a className="lp-btn lp-btn--light" href="/3d">
                                {c.threedCta} →
                            </a>
                        )}
                    </motion.div>
                </div>
            </section>

            {/* ---- Sponsors (only shown when there are sponsors) ---- */}
            {hasSponsors && (
            <section
                id="sponsors"
                data-bg="#f1f6f6"
                className="lp-section lp-section--alt"
            >
                <div className="lp-inner">
                    <motion.div
                        style={{ display: 'block' }}
                        {...reveal}
                        transition={{ duration: 0.5 }}
                    >
                        <p className="lp-kicker">{c.sponsorsSubtitle}</p>
                        <h2 className="lp-h2">{c.sponsorsTitle}</h2>
                        <p className="lp-lead">{c.sponsorsIntro}</p>
                    </motion.div>
                    {sponsorsLoading ? (
                        <p className="lp-loading">Loading…</p>
                    ) : (
                        <SponsorTiers sponsors={sponsors} />
                    )}
                </div>
            </section>
            )}

            {/* ---- FAQ ---- */}
            <section id="qa" data-bg="#ffffff" className="lp-section">
                <div className="lp-inner">
                    <motion.div
                        style={{ display: 'block' }}
                        {...reveal}
                        transition={{ duration: 0.5 }}
                    >
                        <p className="lp-kicker">{c.qaSubtitle}</p>
                        <h2 className="lp-h2">{c.qaTitle}</h2>
                        <p className="lp-lead">{c.qaIntro}</p>
                    </motion.div>
                    {faqLoading ? (
                        <p className="lp-loading">Loading…</p>
                    ) : (
                        <div className="lp-faq">
                            {(faq ?? []).map((item) => {
                                const isOpen = openFaq === item.id;
                                return (
                                    <div key={item.id} className="lp-faq__item">
                                        <button
                                            className="lp-faq__q"
                                            onClick={() =>
                                                setOpenFaq(
                                                    isOpen ? null : item.id
                                                )
                                            }
                                        >
                                            <span>{item.question}</span>
                                            <span className="lp-faq__sign">
                                                {isOpen ? '−' : '+'}
                                            </span>
                                        </button>
                                        <AnimatePresence initial={false}>
                                            {isOpen && (
                                                <motion.div
                                                    className="lp-faq__a"
                                                    initial={{
                                                        height: 0,
                                                        opacity: 0,
                                                    }}
                                                    animate={{
                                                        height: 'auto',
                                                        opacity: 1,
                                                    }}
                                                    exit={{
                                                        height: 0,
                                                        opacity: 0,
                                                    }}
                                                    transition={{
                                                        duration: 0.28,
                                                        ease: 'easeInOut',
                                                    }}
                                                >
                                                    <p>{item.answer}</p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* ---- Talk to us: dual-audience (NGO → book · student → join) ---- */}
            <section id="book" className="lp-section lp-section--book">
                <div className="lp-inner">
                    <motion.div
                        style={{ display: 'block', width: '100%' }}
                        {...reveal}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="lp-talk">
                            <div className="lp-talk__panel">
                                <p className="lp-kicker">{t.talk.ngoKicker}</p>
                                <h2 className="lp-h2">{t.talk.ngoHeading}</h2>
                                <p className="lp-lead">{t.talk.ngoText}</p>
                            </div>
                            <div className="lp-talk__panel">
                                <p className="lp-kicker">{t.talk.studentKicker}</p>
                                <h2 className="lp-h2">{t.talk.studentHeading}</h2>
                                <p className="lp-lead">{t.talk.studentText}</p>
                                <Link
                                    className="lp-btn lp-btn--primary"
                                    href="/join"
                                    style={{ marginTop: 20 }}
                                >
                                    {t.talk.studentCta} →
                                </Link>
                            </div>
                        </div>
                        <div style={{ marginTop: 32, width: '100%' }}>
                            <BookingEmbed />
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ---- Closing CTA ---- */}
            <ClosingCta homepage={props.homepage} />
        </div>
    );
};

export default Landing;
