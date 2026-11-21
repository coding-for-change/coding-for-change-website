'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useCmsCollection, useCmsGlobal, useSiteConfig, useHomepageMode, mediaUrl } from '../../api';
import {
    CmsProject,
    CmsSponsor,
    CmsHomepage,
    CmsTeamMember,
    CmsTechTour,
} from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import { buildProcessSteps } from './ProcessTimeline';
import ProcessSteps from './ProcessSteps';
import ProjectShowcase from './ProjectShowcase';
import Testimonials from './Testimonials';
import ThreeDTeaser from './ThreeDTeaser';
import HeroPhotos, { HERO_SLIDES, useHeroSlideshow } from './HeroPhotos';
import TypedTitle, { TypedPart } from './TypedTitle';
import ClosingCta from './ClosingCta';
import PartnerMarquee, { joinPartners } from './PartnerMarquee';
import RoundStatus from './RoundStatus';
import JoinExpect from './JoinExpect';
import JoinWays from './JoinWays';
import JoinProcess from './JoinProcess';
import useSectionBackgrounds from '../../hooks/useSectionBackgrounds';
import useNow from '../../hooks/useNow';
import { applicationStatus } from '../../lib/applicationPhase';
import './landing.css';
import './join.css';

// Shared scroll-reveal animation. Sections fade/slide in once on first view.
const reveal = {
    initial: { opacity: 0, y: 26 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
} as const;

// Band colours for the scroll painter (useSectionBackgrounds): the brand
// tokens of index.css (--cfc-paper, --cfc-stone, --cfc-petrol) as hex.
const PAPER = '#f1f0ea';
const STONE = '#e4e3da';

/**
 * The hero headline as TypedTitle parts: the white half, then the grey half
 * with its last words (`pixel`, e.g. "stone age.") in the pixel face. Without
 * a match at a word start the grey half stays whole.
 */
const heroParts = (title: string, dim: string, pixel: string): TypedPart[] => {
    const at = pixel ? dim.lastIndexOf(pixel) : -1;
    if (at < 0 || (at > 0 && dim[at - 1] !== ' ')) {
        return [{ text: title }, { text: dim, className: 'lp-hero__dim' }];
    }
    return [
        { text: title },
        ...(at > 0 ? [{ text: dim.slice(0, at), className: 'lp-hero__dim' }] : []),
        { text: dim.slice(at), className: 'lp-hero__dim lp-pixel' },
    ];
};

/** The three ways in, each a card with a photo of that side of the club. */
const WAYS = [
    { key: 'ngo', href: '/ngos', img: '/images/join/project-work.webp', cta: 'home-way-ngo' },
    { key: 'students', href: '/join', img: '/images/join/community-events.webp', cta: 'home-way-join' },
    { key: 'companies', href: '/partners', img: '/images/join/company-visits.webp', cta: 'home-way-partner' },
] as const;

/**
 * Every NGO we work or have worked with, counted in the figures. The Projects
 * collection only holds those with a case study, so the count can't come
 * from there. Add a partner here when one joins.
 */
const NGO_PARTNERS = [
    'Public Makers',
    'Welthungerhilfe',
    'Lebenshilfe München',
    'edunovo',
    'Cycling Without Age',
    'Space-Eye',
    'Verbraucherzentrale Bayern',
];

export interface LandingProps {
    projects?: CmsProject[] | null;
    sponsors?: CmsSponsor[] | null;
    homepage?: CmsHomepage | null;
    /** The members named on the student-mode "ways in" cards. */
    team?: CmsTeamMember[] | null;
    /** For the hosts of its evenings in the logo strip, while the page is listed. */
    techTour?: CmsTechTour | null;
}

const Landing: React.FC<LandingProps> = (props) => {
    const siteConfig = useSiteConfig();
    const { t } = useLanguage();
    const l = t.landing;
    const pathname = usePathname();
    const router = useRouter();

    const { data: projects, loading: projectsLoading } =
        useCmsCollection<CmsProject>('projects', undefined, props.projects);
    const { data: sponsors } =
        useCmsCollection<CmsSponsor>('sponsors', { depth: '1' }, props.sponsors);
    const { data: hp } = useCmsGlobal<CmsHomepage>('homepage', props.homepage);

    // Which audience the page speaks to — the "Homepage audience" switch in
    // the CMS (lib/homepageMode.ts). Student mode is the application round's
    // landing page: the hero talks to applicants, the Join page's sections
    // (what to expect, the ways in, the three steps) stand in for the three
    // ways and the NGO process, and the buttons go to /join/apply.
    const students = useHomepageMode() === 'students';
    const now = useNow();
    const status = applicationStatus(now);

    // Homepage copy: CMS value if set, else the built-in string.
    const c = {
        heroCtaPrimary: hp?.heroCtaPrimary || l.heroCtaPrimary,
        heroCtaSecondary: hp?.heroCtaSecondary || l.heroCtaSecondary,
        statement: hp?.aboutOneLiner || l.statement,
        statementDim: hp?.aboutPitch || l.statementDim,
        processKicker: hp?.processKicker || l.labels.process,
        processHeading: hp?.processHeading || t.process.heading,
        processIntro: hp?.processIntro || t.process.intro,
        projectsKicker: hp?.projectsSubtitle || l.labels.projects,
        projectsTitle: hp?.projectsTitle || t.projects.title,
        projectsIntro: hp?.projectsIntro || t.projects.intro,
    };
    // Process steps: CMS steps override the built-in ones; a CMS step's
    // button defaults to the booking tool on /ngos.
    const processSteps = buildProcessSteps(hp?.steps, t.process.steps, '/ngos#partner-book');

    // Student-mode copy: CMS value if set, else the built-in string. The
    // apply button's wording follows the round ("Get notified" / "Apply now"
    // / "Notify me for the next round"); the CMS can reword the open one.
    const s = {
        heroTitle: hp?.studentHeroTitle || t.studentHome.heroTitle,
        heroLead: hp?.studentHeroLead || t.studentHome.heroLead,
        apply: (status === 'open' && hp?.studentHeroCtaPrimary) || t.join.cta[status],
        howItWorks: hp?.studentHeroCtaSecondary || t.join.howItWorks,
        projectsTitle: hp?.studentProjectsTitle || t.studentHome.projectsTitle,
        projectsIntro: hp?.studentProjectsIntro || t.studentHome.projectsIntro,
    };
    const applyHref = '/join/apply';

    // The figures under the statement: the headcount (typed into Site
    // Configuration), our NGO partners, the events we have run (the figure
    // /partners shows too) and how long the process takes. A figure we have
    // no number for is left out rather than shown as 0.
    const weeks = processSteps[processSteps.length - 1]?.timing?.match(/\d+/)?.[0] ?? '';
    const figures = [
        { value: siteConfig.memberCount?.trim() ?? '', label: t.team.statMembers },
        { value: String(NGO_PARTNERS.length), label: t.team.statNgos },
        { value: '10+', label: l.statEvents },
        { value: weeks, label: l.statWeeks },
    ].filter((f) => f.value !== '');

    const partners = joinPartners(projects, sponsors, props.techTour);
    // The hero photo: the CMS upload (Homepage → Hero image) at full size, else
    // the bundled crossfade (HeroPhotos).
    const heroPhoto =
        (hp?.heroImage && typeof hp.heroImage === 'object' && mediaUrl(hp.heroImage)) || null;
    const slideshow = useHeroSlideshow(heroPhoto ? 1 : HERO_SLIDES.length);
    const caption = heroPhoto ? l.photoCaption : l.photoCaptions[slideshow.active] ?? l.photoCaption;
    // The headline types itself out (with a slip it takes back); the lead and
    // the buttons come in once it is on its way to the real words.
    const [headlineSettled, setHeadlineSettled] = useState(false);

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

    // In-page links go through the router: the site sets <base target="_parent">
    // for the 3D scene's iframe, and a bare hash link would move the scene.
    const toSection = (id: string) => (e: React.MouseEvent) => {
        e.preventDefault();
        router.push(`/#${id}`);
    };

    return (
        <div className={'lp lp--landing' + (students ? ' jn' : '')} ref={bgRef}>
            {/* ---- Hero: one photo, framed in paper; the nav sits on it ---- */}
            <section
                id="home"
                className={'lp-hero' + (students ? ' lp-hero--students' : '')}
                data-bg={PAPER}
                data-nav-over="dark"
            >
                <div className="lp-hero__frame">
                    <HeroPhotos photo={heroPhoto} alt={l.photoAlt} {...slideshow} />
                    <div className="lp-hero__body">
                        <motion.div
                            className={'lp-hero__copy' + (headlineSettled ? '' : ' lp-hero__copy--typing')}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                        >
                            {/* In student mode, the round's status. */}
                            {students && <RoundStatus now={now} className="lp-hero__pill" />}
                            <TypedTitle
                                className="lp-hero__title"
                                parts={
                                    students
                                        ? [{ text: s.heroTitle }]
                                        : heroParts(l.heroTitle, l.heroTitleDim, l.heroTitlePixel)
                                }
                                slip={students ? undefined : l.heroTitleSlip}
                                onSettle={() => setHeadlineSettled(true)}
                            />
                            <p className="lp-hero__lead">{students ? s.heroLead : l.heroLead}</p>
                            <div className="lp-hero__ctas">
                                {students ? (
                                    <>
                                        <Link
                                            className="lp-btn lp-btn--light"
                                            href={applyHref}
                                            data-cta="home-apply-hero"
                                        >
                                            {s.apply} →
                                        </Link>
                                        <a
                                            className="lp-btn lp-btn--glass"
                                            href="#process"
                                            onClick={toSection('process')}
                                        >
                                            {s.howItWorks} ↓
                                        </a>
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            className="lp-btn lp-btn--light"
                                            href="/ngos"
                                            data-cta="home-ngo-hero"
                                        >
                                            {c.heroCtaPrimary} →
                                        </Link>
                                        <Link
                                            className="lp-btn lp-btn--glass"
                                            href="/join"
                                            data-cta="home-join-hero"
                                        >
                                            {c.heroCtaSecondary}
                                        </Link>
                                    </>
                                )}
                            </div>
                        </motion.div>
                        <p className="lp-hero__caption" aria-hidden="true">
                            <span className="lp-hero__caption-text" key={caption}>
                                {caption}
                            </span>
                        </p>
                    </div>
                </div>
            </section>

            {/* ---- Everyone we work with, right under the hero ---- */}
            <PartnerMarquee partners={partners} label={l.partnersLabel} variant="strip" />

            {/* ---- Statement and the figures behind it ---- */}
            <section id="about" data-bg={PAPER} className="lp-section lp-intro">
                <div className="lp-inner">
                    <motion.p className="lp-statement" {...reveal} transition={{ duration: 0.5 }}>
                        {c.statement} <span className="lp-statement__dim">{c.statementDim}</span>
                    </motion.p>
                    {figures.length > 0 && (
                        <motion.ul
                            className="lp-figures"
                            {...reveal}
                            transition={{ duration: 0.5, delay: 0.1 }}
                        >
                            {figures.map((f) => (
                                <li className="lp-figure" key={f.label}>
                                    <span className="lp-figure__value">{f.value}</span>
                                    <span className="lp-figure__label">{f.label}</span>
                                </li>
                            ))}
                        </motion.ul>
                    )}
                </div>
            </section>

            {students ? (
                <>
                    {/* ---- Student mode: the Join page's three sections ---- */}
                    <section data-bg={PAPER} className="lp-section jn-expect">
                        <JoinExpect heading={hp?.studentWhyHeading} lead={hp?.studentWhyIntro} />
                    </section>
                    <section data-bg={STONE} className="lp-section lp-section--alt jn-ways">
                        <JoinWays team={props.team} />
                    </section>
                    <section id="process" data-bg={PAPER} className="lp-section jn-process">
                        <JoinProcess now={now} projects={projects} />
                    </section>
                </>
            ) : (
                /* ---- Three ways in: NGOs, students, companies ---- */
                <section id="ways" data-bg={PAPER} className="lp-section lp-ways">
                    <div className="lp-inner">
                        <motion.div className="lp-head" {...reveal} transition={{ duration: 0.5 }}>
                            <p className="lp-kicker">{l.labels.ways}</p>
                            <h2 className="lp-h2">{l.waysTitle}</h2>
                        </motion.div>
                        <div className="lp-ways__grid">
                            {WAYS.map((way, i) => {
                                const copy = l.ways[way.key];
                                return (
                                    <motion.div
                                        key={way.key}
                                        className="lp-way-cell"
                                        {...reveal}
                                        transition={{ duration: 0.5, delay: i * 0.08 }}
                                    >
                                        <Link className="lp-way" href={way.href} data-cta={way.cta}>
                                            <span className="lp-way__photo">
                                                <img src={way.img} alt="" loading="lazy" />
                                            </span>
                                            <span className="lp-way__body">
                                                <span className="lp-way__label">{copy.label}</span>
                                                <h3 className="lp-way__title">{copy.title}</h3>
                                                <span className="lp-way__text">{copy.text}</span>
                                                <span className="lp-way__more">{copy.cta} →</span>
                                            </span>
                                        </Link>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* ---- Projects ---- */}
            <section id="projects" data-bg={PAPER} className="lp-section">
                <div className="lp-inner">
                    <motion.div
                        className="lp-head lp-head--split"
                        {...reveal}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="lp-head__copy">
                            <p className="lp-kicker">
                                {students ? t.studentHome.projectsSubtitle : c.projectsKicker}
                            </p>
                            <h2 className="lp-h2">{students ? s.projectsTitle : c.projectsTitle}</h2>
                            <p className="lp-lead">{students ? s.projectsIntro : c.projectsIntro}</p>
                        </div>
                        <Link className="lp-textlink" href="/projects">
                            {t.projects.viewAll} →
                        </Link>
                    </motion.div>
                    {projectsLoading ? (
                        <p className="lp-loading">Loading…</p>
                    ) : (
                        <ProjectShowcase projects={projects ?? []} />
                    )}
                </div>
            </section>

            {/* ---- How we work with NGOs: four steps across the petrol band
                 (student mode shows the application steps above instead) ---- */}
            {!students && (
                <ProcessSteps
                    id="process"
                    kicker={c.processKicker}
                    heading={c.processHeading}
                    intro={c.processIntro}
                    steps={processSteps}
                    cta={{ label: l.processCta, href: '/ngos', dataCta: 'home-ngo-process' }}
                />
            )}

            {/* ---- Voices: quotes from NGOs, companies and members ---- */}
            <Testimonials items={hp?.testimonials} bandColor={PAPER} />

            {/* ---- The 3D version of the site (desktop only) ---- */}
            <ThreeDTeaser bandColor={PAPER} />

            {/* ---- Closing claim; the footer's >_♡ follows ---- */}
            <ClosingCta homepage={props.homepage} />
        </div>
    );
};

export default Landing;
