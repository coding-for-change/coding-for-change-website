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
import BookingEmbed from '../general/BookingEmbed';
import './landing.css';

const statusColors: Record<string, string> = {
    active: '#2f8f90',
    completed: '#246b6c',
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
    const src = mediaUrl(shot.image) || '';

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

/** A section heading with the hairline that opens a new movement of the page. */
const BlockHead: React.FC<{ heading?: string | null }> = ({ heading }) =>
    heading ? <h2 className="lp-cs__h">{heading}</h2> : null;

const TextBlock: React.FC<{ block: CmsTextBlock }> = ({ block }) =>
    block.body ? (
        <section className="lp-cs__block lp-cs__block--prose">
            <BlockHead heading={block.heading} />
            <Paragraphs text={block.body} />
        </section>
    ) : null;

const QuoteBlock: React.FC<{ block: CmsQuoteBlock }> = ({ block }) =>
    block.text ? (
        <blockquote className="lp-cs__block lp-cs__block--quote lp-cs__quote">
            <p className="lp-cs__quote-text">{block.text}</p>
            {(block.author || block.role) && (
                <footer className="lp-cs__quote-by">
                    {block.author}
                    {block.author && block.role && ', '}
                    {block.role}
                </footer>
            )}
        </blockquote>
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
        <section className="lp-cs__block lp-cs__block--wide">
            <BlockHead heading={block.heading} />
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
                            <img src={mediaUrl(g.image) || ''} alt={g.caption ?? title} />
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
        </section>
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
    const poster = mediaUrl(block.poster);
    if (!file) return null;

    return (
        <section className="lp-cs__block lp-cs__block--wide">
            <BlockHead heading={block.heading} />
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
        </section>
    );
};

/**
 * The project's phases on a centred vertical line, text alternating left and
 * right of it. A point's image sits under its own text, in the same column, so
 * it can't be read as belonging to the neighbouring step. A single "current" point implies
 * the rest: earlier ones are done, later ones still ahead (same rule as
 * ProcessTimeline). On a phone the line moves to the left edge.
 */
const TimelineBlock: React.FC<{ block: CmsTimelineBlock }> = ({ block }) => {
    const { t } = useLanguage();
    const points = (block.points ?? []).filter((p) => p.title);
    if (points.length === 0) return null;
    const currentIdx = points.findIndex((p) => p.state === 'current');
    const stateOf = (i: number) =>
        points[i].state || (currentIdx === -1 ? undefined : i < currentIdx ? 'done' : 'upcoming');
    // Done steps carry a tick in the node; a "Done" label under "Problem" would
    // read as if the problem were done.
    const badge: Record<string, string> = {
        current: t.caseStudy.stepNow,
        upcoming: t.caseStudy.stepNext,
    };
    return (
        <section className="lp-cs__block lp-cs__block--wide lp-cs-journey">
            <BlockHead heading={block.heading} />
            <ol className="lp-cs-journey__list">
                {points.map((p, i) => {
                    const state = stateOf(i);
                    const img = mediaUrl(p.image);
                    return (
                        <motion.li
                            key={p.id ?? i}
                            className="lp-cs-journey__step"
                            data-state={state}
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.25 }}
                            transition={{ duration: 0.5 }}
                        >
                            <span className="lp-cs-journey__node" aria-hidden>
                                {state === 'done' ? '✓' : p.marker?.trim() || i + 1}
                            </span>
                            <div className="lp-cs-journey__body">
                                {state && badge[state] && (
                                    <span className="lp-cs-journey__badge">{badge[state]}</span>
                                )}
                                <h3 className="lp-cs-journey__title">{p.title}</h3>
                                {p.subtitle && (
                                    <p className="lp-cs-journey__text">{p.subtitle}</p>
                                )}
                                {p.timing && (
                                    <span className="lp-cs-journey__timing">{p.timing}</span>
                                )}
                                {img && (
                                    <figure className="lp-cs-journey__media">
                                        <img
                                            src={img}
                                            alt={p.image?.alt || p.title}
                                            loading="lazy"
                                        />
                                    </figure>
                                )}
                            </div>
                        </motion.li>
                    );
                })}
            </ol>
        </section>
    );
};

const TeamBlock: React.FC<{
    block: CmsTeamBlock;
    project: CmsProject;
    fallbackHeading: string;
}> = ({ block, project, fallbackHeading }) => {
    // The block normally carries no members of its own: the assignment lives on
    // the project, so it survives without a case study and the Team page can
    // read it. `projectTeam` resolves that, falling back to rows written into
    // the block itself by case studies that predate the project-level field.
    const members = projectTeam(project);
    if (members.length === 0) return null;
    return (
        <section className="lp-cs__block lp-cs__block--wide lp-cs-team-band">
            <h2 className="lp-cs__h lp-cs__h--centred">
                {block.heading || fallbackHeading}
            </h2>
            <ul className="lp-cs-team">
                {members.map((m, i) => {
                    const person = m.member;
                    const photo = mediaUrl(person.image);
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
                            <span className="lp-cs-team__name">{person.name}</span>
                            {/* Project role overrides the member's default role. */}
                            <span className="lp-cs-team__role">{m.role || person.role}</span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

const FaqBlock: React.FC<{ block: CmsFaqBlock; heading: string }> = ({ block, heading }) => {
    const items = (block.items ?? []).filter((it) => it.question && it.answer);
    if (items.length === 0) return null;
    return (
        <section className="lp-cs__block lp-cs__block--prose lp-cs-faq">
            <h2 className="lp-cs__h">{heading}</h2>
            {items.map((item, i) => (
                <div className="lp-cs-faq__item" key={item.id ?? i}>
                    <h3 className="lp-cs-faq__q">{item.question}</h3>
                    <p className="lp-cs-faq__a">{item.answer}</p>
                </div>
            ))}
        </section>
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
                        return (
                            <TeamBlock
                                key={key}
                                block={b}
                                project={project}
                                fallbackHeading={t.projectDetail.team}
                            />
                        );
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
 * The product, large: the first "stage" gallery's landscape shot in a macOS
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
        <div className={'lp-cs-stage' + (laptop && phone ? ' lp-cs-stage--pair' : '')}>
            <span className="lp-cs-stage__glow" aria-hidden />
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
                        src={mediaUrl(laptop.image) || ''}
                        alt={laptop.caption ?? title}
                    />
                </motion.div>
            )}
            {phone && (
                <motion.img
                    className="lp-cs-stage__phone"
                    src={mediaUrl(phone.image) || ''}
                    alt={phone.caption ?? title}
                    initial={{ opacity: 0, y: 70 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                />
            )}
        </div>
    );
};

/** "Featured in": press coverage as one compact pill per article. */
const PressBadges: React.FC<{ items: CmsPressItem[] }> = ({ items }) => {
    const { t } = useLanguage();
    if (items.length === 0) return null;
    return (
        <ul className="lp-cs-press">
            {items.map((item, i) => {
                const logo = mediaUrl(item.logo);
                return (
                    <li key={item.id ?? i}>
                        <a
                            className="lp-cs-press__item"
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={item.headline}
                        >
                            <span className="lp-cs-press__label">{t.caseStudy.pressLabel}</span>
                            {logo && (
                                <img className="lp-cs-press__logo" src={logo} alt="" />
                            )}
                            <span className="lp-cs-press__outlet">{item.outlet}</span>
                            <span className="lp-cs-press__cta" aria-hidden>
                                ↗
                            </span>
                        </a>
                    </li>
                );
            })}
        </ul>
    );
};

/* ---- The case-study page ----
   1. Hero: the claim, the press, and the product itself, large.
   2. The story: the CMS blocks, centred, in the order the editor set.
   3. The team.
   4. Two ways in: nonprofits book a call, students join.

   Every block is centred on one axis and picks a measure: prose for reading,
   wide for designed panels (journey, media, team, the closing cards). */
const ProjectCaseStudy: React.FC<{ project: CmsProject }> = ({ project }) => {
    const { t } = useLanguage();
    const mark = mediaUrl(project.image);
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

    return (
        <div className="lp lp-page lp-cs-page">
            <header className="lp-cs-hero">
                <div className="lp-inner lp-cs-hero__inner">
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
                                className="lp-dot"
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
                        <PressBadges items={press} />
                    </motion.div>
                </div>
                <DeviceStage laptop={laptop} phone={phone} title={project.title} />
                {/* The deck comes after the product: on arrival the screen
                    belongs to the claim and the interface. */}
                {project.impact && (
                    <div className="lp-inner">
                        <p className="lp-cs__lead">{project.impact}</p>
                    </div>
                )}
            </header>

            <div className="lp-inner">
                <article className="lp-cs">
                    {/* Facts strip: the partner's own mark, then the details a
                        visitor scans for. */}
                    <div className="lp-cs__facts">
                        {mark && (
                            <span className="lp-cs__mark">
                                <img src={mark} alt={project.ngoPartner} />
                            </span>
                        )}
                        <div className="lp-cs__fact-set">
                            <span className="lp-cs__fact">
                                <span className="lp-cs__fact-k">
                                    {t.projectDetail.partnerLabel}
                                </span>
                                <span className="lp-cs__fact-v">{project.ngoPartner}</span>
                            </span>
                            {stack.length > 0 && (
                                <span className="lp-cs__fact">
                                    <span className="lp-cs__fact-k">{t.projectDetail.stack}</span>
                                    <span className="lp-cs__fact-v">{stack.join(' · ')}</span>
                                </span>
                            )}
                            {links.length > 0 && (
                                <span className="lp-cs__fact">
                                    <span className="lp-cs__fact-k">{t.projectDetail.links}</span>
                                    <span className="lp-cs__fact-v">
                                        {links.map((l, i) => (
                                            <React.Fragment key={l.id ?? i}>
                                                {i > 0 && ' · '}
                                                <a
                                                    className="lp-cs__fact-link"
                                                    href={l.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    {l.label}
                                                </a>
                                            </React.Fragment>
                                        ))}
                                    </span>
                                </span>
                            )}
                        </div>
                    </div>

                    <CaseStudyBlocks project={project} skip={promoted} />

                    {/* Two ways in. The calendar opens in an overlay: inline it
                        is ~900px of widget that would push the story off screen. */}
                    <section className="lp-cs__block lp-cs__block--wide lp-cs-cta">
                        <div className="lp-cs-cta__card lp-cs-cta__card--ngo">
                            <span className="lp-cs-cta__kicker">{t.talk.ngoKicker}</span>
                            <h2 className="lp-cs-cta__heading">{t.caseStudy.bookHeading}</h2>
                            <p className="lp-cs-cta__text">{t.caseStudy.bookText}</p>
                            <div className="lp-cs-cta__actions">
                                <BookingEmbed variant="compact" />
                            </div>
                        </div>
                        <div className="lp-cs-cta__card lp-cs-cta__card--student">
                            <span className="lp-cs-cta__kicker">{t.talk.studentKicker}</span>
                            <h2 className="lp-cs-cta__heading">{t.caseStudy.joinHeading}</h2>
                            <p className="lp-cs-cta__text">{t.caseStudy.joinText}</p>
                            <div className="lp-cs-cta__actions">
                                <Link className="lp-btn lp-btn--primary" href="/join">
                                    {t.caseStudy.joinButton} →
                                </Link>
                                <Link className="lp-booking__link" href="/team">
                                    {t.caseStudy.teamLink}
                                </Link>
                            </div>
                        </div>
                    </section>

                    <p className="lp-cs__foot">
                        <Link className="lp-cs__more" href="/projects">
                            {t.caseStudy.moreProjects} →
                        </Link>
                    </p>
                </article>
            </div>
        </div>
    );
};

export default ProjectCaseStudy;
