'use client';
import React, { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { mediaUrl } from '../../api';
import {
    CmsProject,
    CmsGalleryImage,
    CmsTextBlock,
    CmsQuoteBlock,
    CmsGalleryBlock,
    CmsTimelineBlock,
    CmsTeamBlock,
    CmsFaqBlock,
    CmsDemoBlock,
    CmsPressItem,
} from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import { projectTeam } from '../../lib/projects';
import { useOverlay } from '../../hooks/useOverlay';
import CaseStudyHead from './CaseStudyHead';
import ClosingCta from './ClosingCta';
import LebenshilfeStory from './LebenshilfeStory';
import './landing.css';

/* Chapters that belong to one project only (a diagram, a map) and so live in
   code rather than in the CMS. They sit between the facts and the CMS blocks. */
const PROJECT_STORIES: Record<string, React.FC> = {
    lebenshilfe: LebenshilfeStory,
};

// The eyebrow's dot: brand petrol (--cfc-petrol / --cfc-petrol-deep in index.css).
const statusColors: Record<string, string> = {
    active: '#0b4643',
    completed: '#073431',
    recruiting: '#b5651d',
};
// The facts strip's live dot: green while the project runs.
const liveColors: Record<string, string> = {
    active: '#1e9e5a',
    completed: '#073431',
    recruiting: '#b5651d',
};

const Paragraphs: React.FC<{ text?: string | null }> = ({ text }) =>
    text ? (
        <>
            {text
                .split('\n')
                .filter(Boolean)
                .map((p, i) => (
                    <p key={i} className="lp-cs__p">
                        {p}
                    </p>
                ))}
        </>
    ) : null;

type Shot = CmsGalleryImage;

/** One chapter of the page: a band with the shell's measure inside. */
const Section: React.FC<{ className?: string; children: React.ReactNode }> = ({
    className,
    children,
}) => (
    <section className={'lp-cs-sec' + (className ? ` ${className}` : '')}>
        <div className="lp-inner">{children}</div>
    </section>
);

/**
 * Full-screen, keyboard-navigable image viewer for a gallery block. Rendered in
 * a portal on <body> so it covers the whole viewport regardless of the
 * transformed page shell (`.site-page` has a transform → new containing block).
 * ← / → navigate (wrapping), Esc closes, backdrop click closes.
 */
const Lightbox: React.FC<{
    shots: Shot[];
    index: number;
    title: string;
    onClose: () => void;
    onNavigate: (index: number) => void;
}> = ({ shots, index, title, onClose, onNavigate }) => {
    const count = shots.length;
    const go = useCallback(
        (delta: number) => onNavigate((index + delta + count) % count),
        [index, count, onNavigate]
    );

    const onKey = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') go(1);
            else if (e.key === 'ArrowLeft') go(-1);
        },
        [go]
    );
    useOverlay(onClose, onKey);

    if (typeof document === 'undefined') return null;

    const shot = shots[index];
    const src = mediaUrl(shot.image, 'large') || '';

    return createPortal(
        <div
            className="lp-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={shot.caption || title}
            onClick={onClose}
        >
            <button
                type="button"
                className="lp-lightbox__close"
                aria-label="Close"
                onClick={onClose}
            >
                ×
            </button>
            {count > 1 && (
                <button
                    type="button"
                    className="lp-lightbox__nav lp-lightbox__nav--prev"
                    aria-label="Previous image"
                    onClick={(e) => {
                        e.stopPropagation();
                        go(-1);
                    }}
                >
                    ‹
                </button>
            )}
            <figure
                className="lp-lightbox__figure"
                onClick={(e) => e.stopPropagation()}
            >
                <img className="lp-lightbox__img" src={src} alt={shot.caption ?? title} />
                {(shot.caption || count > 1) && (
                    <figcaption className="lp-lightbox__cap">
                        {shot.caption && <span>{shot.caption}</span>}
                        {count > 1 && (
                            <span className="lp-lightbox__count">
                                {index + 1} / {count}
                            </span>
                        )}
                    </figcaption>
                )}
            </figure>
            {count > 1 && (
                <button
                    type="button"
                    className="lp-lightbox__nav lp-lightbox__nav--next"
                    aria-label="Next image"
                    onClick={(e) => {
                        e.stopPropagation();
                        go(1);
                    }}
                >
                    ›
                </button>
            )}
        </div>,
        document.body
    );
};

/* ---- Content blocks (rendered in the CMS-defined order) ---- */

const TextBlock: React.FC<{ block: CmsTextBlock }> = ({ block }) =>
    block.body ? (
        <Section>
            <CaseStudyHead heading={block.heading} />
            <div className="lp-cs-prose">
                <Paragraphs text={block.body} />
            </div>
        </Section>
    ) : null;

const QuoteBlock: React.FC<{ block: CmsQuoteBlock }> = ({ block }) =>
    block.text ? (
        <Section>
            <blockquote className="lp-cs__quote">
                <p className="lp-cs__quote-text">{block.text}</p>
                {(block.author || block.role) && (
                    <footer className="lp-cs__quote-by">
                        {block.author}
                        {block.author && block.role && ', '}
                        {block.role}
                    </footer>
                )}
            </blockquote>
        </Section>
    ) : null;

/**
 * A gallery in one of two registers, chosen per block in the CMS:
 *
 * - `stage` — product shots (app screens, device mock-ups) stood on a shared
 *   tinted ground. Bottom-aligned and sized by their own aspect ratio, so a
 *   phone stands taller than a laptop instead of both being letterboxed into an
 *   identical row of floating rectangles.
 * - `photos` — photographs (workshops, on-site visits, presentations) in an
 *   edge-to-edge grid, uniformly cropped, the first one given a double cell so
 *   the block leads with an image instead of reading as a contact sheet.
 */
const GalleryBlock: React.FC<{
    block: CmsGalleryBlock;
    title: string;
    skip: Set<Shot>;
}> = ({ block, title, skip }) => {
    const items = (block.images ?? []).filter((g) => mediaUrl(g.image) && !skip.has(g));
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    if (items.length === 0) return null;
    const photos = block.layout === 'photos';
    return (
        <Section>
            <CaseStudyHead heading={block.heading} />
            <div
                className={
                    'lp-cs-gal' +
                    (photos ? ' lp-cs-gal--photos' : ' lp-cs-gal--stage') +
                    (photos && items.length > 2 ? ' lp-cs-gal--lead' : '')
                }
            >
                {items.map((g, i) => (
                    <figure className="lp-cs-gal__item" key={g.id ?? i}>
                        <button
                            type="button"
                            className="lp-cs-gal__btn"
                            onClick={() => setOpenIndex(i)}
                            aria-label={
                                g.caption ? `View image: ${g.caption}` : `View image ${i + 1}`
                            }
                        >
                            <img src={mediaUrl(g.image, 'large') || ''} alt={g.caption ?? title} />
                        </button>
                        {g.caption && (
                            <figcaption className="lp-cs-gal__cap">{g.caption}</figcaption>
                        )}
                    </figure>
                ))}
            </div>
            {openIndex !== null && (
                <Lightbox
                    shots={items}
                    index={openIndex}
                    title={title}
                    onClose={() => setOpenIndex(null)}
                    onNavigate={setOpenIndex}
                />
            )}
        </Section>
    );
};

/**
 * A product demo: a screen recording uploaded through the CMS, served from our
 * own origin.
 *
 * Deliberately upload-only. A YouTube/Vimeo embed shipped here first and the
 * consent scan rejected it, correctly: those players set cookies on a visitor's
 * device the moment they load, which under TDDDG § 25 needs consent whether the
 * load is automatic or click-triggered. Supporting them means a declared Klaro
 * service, a consent gate, and an Art. 13 entry in the Datenschutz — see the
 * consent section of CLAUDE.md. Until that exists, self-hosted only.
 *
 * Not auto-played: a demo is something a visitor chooses to watch, and an
 * unbidden moving image derails the page around it.
 */
const DemoBlock: React.FC<{ block: CmsDemoBlock }> = ({ block }) => {
    const file = mediaUrl(block.video);
    const poster = mediaUrl(block.poster, 'large');
    if (!file) return null;

    return (
        <Section>
            <CaseStudyHead heading={block.heading} />
            <figure className="lp-cs-demo">
                <div className="lp-cs-demo__frame">
                    <video
                        className="lp-cs-demo__media"
                        src={file}
                        poster={poster || undefined}
                        controls
                        playsInline
                        preload="metadata"
                    />
                </div>
                {block.caption && (
                    <figcaption className="lp-cs-demo__cap">{block.caption}</figcaption>
                )}
            </figure>
        </Section>
    );
};

const Check = () => (
    <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M20 6L9 17l-5-5" />
    </svg>
);

/**
 * The project's phases side by side on one track, read left to right. A single
 * "current" point implies the rest: earlier ones are done, later ones still
 * ahead (same rule as ProcessTimeline). Without any state it is a plain,
 * numbered sequence. On a phone the track turns vertical.
 */
const TimelineBlock: React.FC<{ block: CmsTimelineBlock }> = ({ block }) => {
    const { t } = useLanguage();
    const points = (block.points ?? []).filter((p) => p.title);
    if (points.length === 0) return null;
    const currentIdx = points.findIndex((p) => p.state === 'current');
    const stateOf = (i: number) =>
        points[i].state || (currentIdx === -1 ? undefined : i < currentIdx ? 'done' : 'upcoming');
    const label: Record<string, string> = {
        done: t.caseStudy.stepDone,
        current: t.caseStudy.stepNow,
        upcoming: t.caseStudy.stepNext,
    };
    return (
        <Section>
            <CaseStudyHead kicker={t.caseStudy.kickerProgress} heading={block.heading} />
            <ol
                className="lp-cs-steps"
                style={{ '--cs-steps': points.length } as React.CSSProperties}
            >
                {points.map((p, i) => {
                    const state = stateOf(i);
                    const img = mediaUrl(p.image, 'thumbnail');
                    return (
                        <li key={p.id ?? i} className="lp-cs-steps__item" data-state={state}>
                            <span className="lp-cs-steps__line" aria-hidden />
                            <span className="lp-cs-steps__node" aria-hidden>
                                {state === 'done' ? (
                                    <Check />
                                ) : state === 'current' ? (
                                    <span className="lp-cs-steps__core" />
                                ) : state ? null : (
                                    p.marker?.trim() || i + 1
                                )}
                            </span>
                            {state && label[state] && (
                                <span className="lp-cs-steps__label">{label[state]}</span>
                            )}
                            <h3 className="lp-cs-steps__title">{p.title}</h3>
                            {p.subtitle && <p className="lp-cs-steps__text">{p.subtitle}</p>}
                            {p.timing && <span className="lp-cs-steps__timing">{p.timing}</span>}
                            {img && (
                                <img
                                    className="lp-cs-steps__img"
                                    src={img}
                                    alt={p.image?.alt || p.title}
                                    loading="lazy"
                                />
                            )}
                        </li>
                    );
                })}
            </ol>
        </Section>
    );
};

const TeamBlock: React.FC<{ block: CmsTeamBlock; project: CmsProject }> = ({
    block,
    project,
}) => {
    const { t } = useLanguage();
    // The block normally carries no members of its own: the assignment lives on
    // the project, so it survives without a case study and the Team page can
    // read it. `projectTeam` resolves that, falling back to rows written into
    // the block itself by case studies that predate the project-level field.
    const members = projectTeam(project);
    if (members.length === 0) return null;
    return (
        <Section>
            <CaseStudyHead
                kicker={t.caseStudy.kickerTeam}
                heading={block.heading || t.projectDetail.team}
            />
            <ul className="lp-cs-team">
                {members.map((m, i) => {
                    const person = m.member;
                    const photo = mediaUrl(person.image, 'thumbnail');
                    return (
                        <li className="lp-cs-team__card" key={m.id ?? i}>
                            {photo ? (
                                <img
                                    className="lp-cs-team__photo"
                                    src={photo}
                                    alt={person.name}
                                    loading="lazy"
                                />
                            ) : (
                                <span
                                    className="lp-cs-team__photo lp-cs-team__photo--empty"
                                    aria-hidden
                                />
                            )}
                            <span className="lp-cs-team__text">
                                <span className="lp-cs-team__name">{person.name}</span>
                                {/* Project role overrides the member's default role. */}
                                <span className="lp-cs-team__role">{m.role || person.role}</span>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </Section>
    );
};

const FaqBlock: React.FC<{ block: CmsFaqBlock; heading: string }> = ({ block, heading }) => {
    const items = (block.items ?? []).filter((it) => it.question && it.answer);
    if (items.length === 0) return null;
    return (
        <Section>
            <CaseStudyHead heading={heading} />
            <div className="lp-cs-prose lp-cs-faq">
                {items.map((item, i) => (
                    <div className="lp-cs-faq__item" key={item.id ?? i}>
                        <h3 className="lp-cs-faq__q">{item.question}</h3>
                        <p className="lp-cs-faq__a">{item.answer}</p>
                    </div>
                ))}
            </div>
        </Section>
    );
};

/** Renders the project's `layout` blocks in order, dispatching on block type. */
const CaseStudyBlocks: React.FC<{ project: CmsProject; skip: Set<Shot> }> = ({
    project,
    skip,
}) => {
    const { t } = useLanguage();
    const blocks = project.layout ?? [];
    if (blocks.length === 0) return null;
    return (
        <>
            {blocks.map((b, i) => {
                const key = b.id ?? `${b.blockType}-${i}`;
                switch (b.blockType) {
                    case 'text':
                        return <TextBlock key={key} block={b} />;
                    case 'quote':
                        return <QuoteBlock key={key} block={b} />;
                    case 'gallery':
                        return (
                            <GalleryBlock
                                key={key}
                                block={b}
                                title={project.title}
                                skip={skip}
                            />
                        );
                    case 'demo':
                        return <DemoBlock key={key} block={b} />;
                    case 'timeline':
                        return <TimelineBlock key={key} block={b} />;
                    case 'team':
                        return <TeamBlock key={key} block={b} project={project} />;
                    case 'faq':
                        return <FaqBlock key={key} block={b} heading={t.caseStudy.faqHeading} />;
                    default:
                        return null;
                }
            })}
        </>
    );
};

/* ---- Hero pieces ---- */

/**
 * The product, large: the first "stage" gallery's landscape shot in a browser
 * window, with its portrait shot (the phone, already framed in its device)
 * standing in front of it. The landscape shot should be a bare screenshot of
 * the app – the window chrome is drawn here. Both shots are then left out of the
 * gallery further down.
 */
const pickHeroShots = (project: CmsProject) => {
    const stage = (project.layout ?? []).find(
        (b): b is CmsGalleryBlock => b.blockType === 'gallery' && b.layout !== 'photos'
    );
    const shots = (stage?.images ?? []).filter((g) => mediaUrl(g.image));
    const ratio = (g: Shot) => (g.image?.width ?? 0) / (g.image?.height || 1);
    const laptop = shots.find((g) => ratio(g) > 1.1);
    const phone = shots.find((g) => ratio(g) > 0 && ratio(g) < 0.8);
    return { laptop, phone };
};

const DeviceStage: React.FC<{ laptop?: Shot; phone?: Shot; title: string }> = ({
    laptop,
    phone,
    title,
}) => {
    if (!laptop && !phone) return null;
    return (
        <div className="lp-cs-stage-wrap">
            <div
                className={
                    'lp-cs-stage' +
                    (laptop && phone ? ' lp-cs-stage--pair' : '') +
                    (!laptop ? ' lp-cs-stage--phone' : '')
                }
            >
                {laptop && (
                    <motion.div
                        className="lp-cs-window"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="lp-cs-window__bar" aria-hidden>
                            <span />
                            <span />
                            <span />
                        </div>
                        <img
                            className="lp-cs-window__screen"
                            src={mediaUrl(laptop.image, 'large') || ''}
                            alt={laptop.caption ?? title}
                        />
                    </motion.div>
                )}
                {phone && (
                    <motion.img
                        className="lp-cs-stage__phone"
                        src={mediaUrl(phone.image, 'large') || ''}
                        alt={phone.caption ?? title}
                        initial={{ opacity: 0, y: 70 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    />
                )}
            </div>
        </div>
    );
};

/** "Featured in": press coverage as one compact pill per article. */
const PressBadges: React.FC<{ items: CmsPressItem[] }> = ({ items }) => {
    const { t } = useLanguage();
    if (items.length === 0) return null;
    return (
        <ul className="lp-cs-press">
            {items.map((item, i) => (
                <li key={item.id ?? i}>
                    <a
                        className="lp-cs-press__item"
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={item.headline}
                    >
                        <span className="lp-cs-press__label">{t.caseStudy.pressLabel}</span>
                        <span className="lp-cs-press__outlet">{item.outlet}</span>
                        <span className="lp-cs-press__cta" aria-hidden>
                            ↗
                        </span>
                    </a>
                </li>
            ))}
        </ul>
    );
};

/** The articles in full: outlet mark, outlet and date, headline. */
const PressCards: React.FC<{ items: CmsPressItem[] }> = ({ items }) => {
    const { t, locale } = useLanguage();
    if (items.length === 0) return null;
    const formatDate = (iso?: string | null) => {
        if (!iso) return null;
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return null;
        return d.toLocaleDateString(
            locale === 'de' ? 'de-DE' : 'en-GB',
            locale === 'de'
                ? { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }
                : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Berlin' }
        );
    };
    return (
        <Section className="lp-cs-sec--press">
            <CaseStudyHead kicker={t.caseStudy.kickerPress} />
            <ul className="lp-cs-articles">
                {items.map((item, i) => {
                    const logo = mediaUrl(item.logo, 'thumbnail');
                    const date = formatDate(item.date);
                    return (
                        <li key={item.id ?? i}>
                            <a
                                className={'lp-cs-article' + (logo ? '' : ' lp-cs-article--bare')}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {logo && <img className="lp-cs-article__logo" src={logo} alt="" />}
                                <span className="lp-cs-article__body">
                                    <span className="lp-cs-article__meta">
                                        {item.outlet}
                                        {date && ` · ${date}`}
                                    </span>
                                    <span className="lp-cs-article__headline">{item.headline}</span>
                                </span>
                                <span className="lp-cs-article__cta">
                                    {t.caseStudy.pressRead} ↗
                                </span>
                            </a>
                        </li>
                    );
                })}
            </ul>
        </Section>
    );
};

const GlobeIcon = () => (
    <svg
        aria-hidden="true"
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);

const GitHubIcon = () => (
    <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24">
        <path
            fill="currentColor"
            d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
        />
    </svg>
);

const isGitHub = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, '') === 'github.com';
    } catch {
        return false;
    }
};

/* ---- The case-study page ----
   1. Hero: the claim, the lead, the press, and the product itself, large.
   2. The facts: partner, phase, stack, links.
   3. The project's own chapters, if it has any (PROJECT_STORIES).
   4. The CMS blocks, in the order the editor set.
   5. The press, then the site's closing claim.

   Every chapter is a band with the shell's measure inside: a mono kicker and a
   heading on the left edge, the content under them. */
const ProjectCaseStudy: React.FC<{ project: CmsProject }> = ({ project }) => {
    const { t } = useLanguage();
    const mark = mediaUrl(project.image, 'thumbnail');
    const statusLabel =
        (t.projects.status as Record<string, string>)[project.status] || project.status;
    const stack = (project.technologies ?? [])
        .map((tech) => tech.name)
        .filter(Boolean);
    const links = (project.links ?? []).filter((l) => l.url && l.label);
    const press = (project.press ?? []).filter((p) => p.url && p.outlet && p.headline);
    const { laptop, phone } = useMemo(() => pickHeroShots(project), [project]);
    const promoted = useMemo(
        () => new Set([laptop, phone].filter((g): g is Shot => !!g)),
        [laptop, phone]
    );
    // The phase the project is in, from its timeline; the status otherwise.
    const phase = useMemo(() => {
        for (const b of project.layout ?? []) {
            if (b.blockType !== 'timeline') continue;
            const current = (b.points ?? []).find((p) => p.state === 'current');
            if (current?.title) return current.title;
        }
        return statusLabel;
    }, [project.layout, statusLabel]);
    const Story = project.slug ? PROJECT_STORIES[project.slug] : undefined;

    return (
        <div className="lp lp-cs-page">
            <header className="lp-cs-hero">
                <div className="lp-inner">
                    <Link className="lp-cs__back" href="/projects">
                        ← {t.projectDetail.back}
                    </Link>
                    <motion.div
                        className="lp-cs-hero__copy"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <p className="lp-cs__eyebrow">
                            <span
                                className="lp-cs__dot"
                                style={{
                                    backgroundColor: statusColors[project.status] || '#808080',
                                }}
                            />
                            {statusLabel}
                            <span className="lp-cs__sep">·</span>
                            {project.ngoPartner}
                        </p>
                        <h1 className="lp-cs__title">
                            {project.impactHeadline || project.title}
                        </h1>
                        {project.impact && <p className="lp-cs__lead">{project.impact}</p>}
                        <PressBadges items={press} />
                    </motion.div>
                </div>
                <DeviceStage laptop={laptop} phone={phone} title={project.title} />
            </header>

            <div className="lp-inner">
                <div className="lp-cs-facts">
                    {mark && (
                        <>
                            <img className="lp-cs-facts__mark" src={mark} alt={project.ngoPartner} />
                            <span className="lp-cs-facts__rule" aria-hidden />
                        </>
                    )}
                    <div className="lp-cs-facts__set">
                        <span className="lp-cs-fact">
                            <span className="lp-cs-fact__k">{t.projectDetail.partnerLabel}</span>
                            <span className="lp-cs-fact__v">{project.ngoPartner}</span>
                        </span>
                        <span className="lp-cs-fact">
                            <span className="lp-cs-fact__k">{t.projectDetail.status}</span>
                            <span className="lp-cs-fact__v">
                                <span
                                    className="lp-cs-fact__live"
                                    style={{
                                        backgroundColor: liveColors[project.status] || '#808080',
                                    }}
                                    aria-hidden
                                />
                                {phase}
                            </span>
                        </span>
                        {stack.length > 0 && (
                            <span className="lp-cs-fact">
                                <span className="lp-cs-fact__k">{t.projectDetail.stack}</span>
                                <span className="lp-cs-fact__v">{stack.join(' · ')}</span>
                            </span>
                        )}
                    </div>
                    {links.length > 0 && (
                        <span className="lp-cs-facts__links">
                            {links.map((l, i) => (
                                <a
                                    key={l.id ?? i}
                                    className="lp-cs-facts__link"
                                    href={l.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={l.label}
                                    title={l.label}
                                >
                                    {isGitHub(l.url) ? <GitHubIcon /> : <GlobeIcon />}
                                </a>
                            ))}
                        </span>
                    )}
                </div>
            </div>

            {Story && <Story />}

            <CaseStudyBlocks project={project} skip={promoted} />

            <PressCards items={press} />

            <ClosingCta />
        </div>
    );
};

export default ProjectCaseStudy;
