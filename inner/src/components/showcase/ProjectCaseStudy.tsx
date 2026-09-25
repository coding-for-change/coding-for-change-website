'use client';
import React, { useCallback, useState } from 'react';
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
} from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import { projectTeam } from '../../lib/projects';
import { useOverlay } from '../../hooks/useOverlay';
import BookingEmbed from '../general/BookingEmbed';
import ProcessTimeline from './ProcessTimeline';
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
const GalleryBlock: React.FC<{ block: CmsGalleryBlock; title: string }> = ({
    block,
    title,
}) => {
    const items = (block.images ?? []).filter((g) => mediaUrl(g.image));
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

const TimelineBlock: React.FC<{ block: CmsTimelineBlock }> = ({ block }) => {
    const points = (block.points ?? []).filter((p) => p.title);
    if (points.length === 0) return null;
    return (
        <section className="lp-cs__block lp-cs__block--prose lp-cs__timeline">
            <BlockHead heading={block.heading} />
            <ProcessTimeline
                className="lp-tl--cs"
                steps={points.map((p) => {
                    const img = mediaUrl(p.image);
                    return {
                        title: p.title,
                        text: p.subtitle || undefined,
                        timing: p.timing || undefined,
                        marker: p.marker?.trim() || undefined,
                        state: p.state || undefined,
                        media: img ? { src: img, alt: p.title } : undefined,
                    };
                })}
            />
        </section>
    );
};

const TeamBlock: React.FC<{
    block: CmsTeamBlock;
    project: CmsProject;
    fallbackHeading: string;
}> = ({ block, project, fallbackHeading }) => {
    const { t } = useLanguage();
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
            <Link className="lp-cs__more" href="/team">
                {t.caseStudy.teamLink} →
            </Link>
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
const CaseStudyBlocks: React.FC<{ project: CmsProject }> = ({ project }) => {
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
                        return <GalleryBlock key={key} block={b} title={project.title} />;
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

/* ---- The case-study page ----
   A masthead that states what happened and for whom, the CMS-ordered body, then
   the two things a nonprofit reading this needs next: what working with us
   costs them, and a way to start the conversation.

   Widths do the structural work. Every block is centred on one axis and picks a
   measure from three: prose for reading, mid for lists and quotes, wide for
   media and the team. Nothing is left-aligned inside a wider box — that reads as
   a mistake, not as a layout. */
const ProjectCaseStudy: React.FC<{ project: CmsProject }> = ({ project }) => {
    const { t } = useLanguage();
    const mark = mediaUrl(project.image);
    const statusLabel =
        (t.projects.status as Record<string, string>)[project.status] || project.status;
    const stack = (project.technologies ?? [])
        .map((tech) => tech.name)
        .filter(Boolean);
    const links = (project.links ?? []).filter((l) => l.url && l.label);

    return (
        <div className="lp lp-page lp-cs-page">
            <div className="lp-inner">
                <motion.article
                    className="lp-cs"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <header className="lp-cs__masthead">
                        <Link className="lp-cs__back" href="/projects">
                            ← {t.projectDetail.back}
                        </Link>
                        <p className="lp-cs__eyebrow">
                            <span
                                className="lp-dot"
                                style={{
                                    backgroundColor:
                                        statusColors[project.status] || '#808080',
                                }}
                            />
                            {statusLabel}
                            <span className="lp-cs__sep">·</span>
                            {t.caseStudy.eyebrow}
                        </p>
                        <h1 className="lp-cs__title">
                            {project.impactHeadline || project.title}
                        </h1>
                        {project.impact && <p className="lp-cs__lead">{project.impact}</p>}

                        {/* Facts strip: the partner's own mark, then the details a
                            visitor scans for. The logo is *contained* here rather
                            than blown up into a hero — a brand square at full
                            width is a slab of colour that says nothing and buries
                            the copy (same call as the projects feature). */}
                        <div className="lp-cs__facts">
                            {mark && (
                                <span className="lp-cs__mark">
                                    <img src={mark} alt={project.ngoPartner} />
                                </span>
                            )}
                            {/* The cells wrap inside their own group, so a third
                                fact drops under the first two rather than under
                                the mark — which would leave the mark hanging off
                                the top of a two-line strip. */}
                            <div className="lp-cs__fact-set">
                                <span className="lp-cs__fact">
                                    <span className="lp-cs__fact-k">
                                        {t.projectDetail.partnerLabel}
                                    </span>
                                    <span className="lp-cs__fact-v">{project.ngoPartner}</span>
                                </span>
                                {stack.length > 0 && (
                                    <span className="lp-cs__fact">
                                        <span className="lp-cs__fact-k">
                                            {t.projectDetail.stack}
                                        </span>
                                        <span className="lp-cs__fact-v">
                                            {stack.join(' · ')}
                                        </span>
                                    </span>
                                )}
                                {links.length > 0 && (
                                    <span className="lp-cs__fact">
                                        <span className="lp-cs__fact-k">
                                            {t.projectDetail.links}
                                        </span>
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
                    </header>

                    <CaseStudyBlocks project={project} />

                    {/* Reassurance: how partnering works. Full pitch lives at /ngos. */}
                    <section className="lp-cs__block lp-cs__block--wide lp-cs-working">
                        <h2 className="lp-cs__h lp-cs__h--centred">
                            {t.caseStudy.workingHeading}
                        </h2>
                        <ul className="lp-cs-working__row">
                            {t.caseStudy.workingPoints.map((pt, i) => (
                                <li className="lp-cs-working__point" key={i}>
                                    <span className="lp-cs-working__num">{i + 1}</span>
                                    <span className="lp-cs-working__text">{pt}</span>
                                </li>
                            ))}
                        </ul>
                        <Link className="lp-cs__more" href="/ngos">
                            {t.caseStudy.partnerLink} →
                        </Link>
                    </section>

                    {/* Book-a-meeting — the primary action for a nonprofit reading
                        this. The calendar itself opens in an overlay: inline it is
                        ~900px of widget, which on a page whose job is to tell a
                        story pushes the story off the screen. */}
                    <section className="lp-cs__block lp-cs__block--wide lp-cs-book">
                        <div className="lp-cs-book__copy">
                            <h2 className="lp-cs-book__heading">{t.caseStudy.bookHeading}</h2>
                            <p className="lp-cs-book__text">{t.caseStudy.bookText}</p>
                        </div>
                        <BookingEmbed variant="compact" />
                    </section>

                    <p className="lp-cs__foot">
                        <Link className="lp-cs__more" href="/projects">
                            {t.caseStudy.moreProjects} →
                        </Link>
                    </p>
                </motion.article>
            </div>
        </div>
    );
};

export default ProjectCaseStudy;
