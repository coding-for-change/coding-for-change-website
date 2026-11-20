'use client';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCmsCollection, useCmsGlobal, useSiteConfig, mediaUrl } from '../../api';
import type { CmsPartner, CmsHomepage, CmsFaqItem, CmsProject } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import BookingEmbed from '../general/BookingEmbed';
import ClosingCta from './ClosingCta';
import FaqList from './FaqList';
import ProcessSteps from './ProcessSteps';
import ProjectShowcase from './ProjectShowcase';
import Testimonials from './Testimonials';
import Recognition from './Recognition';
import { buildProcessSteps } from './ProcessTimeline';
import './landing.css';

const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
} as const;

/** Our team showing Lebenshilfe München its app – unless the CMS sets a hero image. */
const HEAD_PHOTO = '/images/join/project-work.webp';

/**
 * Scroll to a section of this page. A plain hash link would reload the page
 * inside the 3D scene, whose <base target="_parent"> sends it to the parent.
 */
const scrollTo = (id: string) => (e: React.MouseEvent) => {
    const el = document.getElementById(id);
    if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

export interface PartnerProps {
    partner?: CmsPartner | null;
    homepage?: CmsHomepage | null;
    faq?: CmsFaqItem[] | null;
    projects?: CmsProject[] | null;
}

/**
 * /ngos – the page for non-profits. It opens with a question and a photo of a
 * real project meeting, then earns trust before it explains: press and
 * awards, what we have built and for whom (each project with its NGO's logo);
 * then the facts at a glance, how a project runs, their questions and the
 * booking tool.
 */
const Partner: React.FC<PartnerProps> = (props) => {
    const { t } = useLanguage();
    const p = t.pages;
    const siteConfig = useSiteConfig();
    const { data: partner } = useCmsGlobal<CmsPartner>('partner', props.partner);
    const { data: hp } = useCmsGlobal<CmsHomepage>('homepage', props.homepage);
    const { data: faq } = useCmsCollection<CmsFaqItem>('faq', undefined, props.faq);
    const { data: projects } = useCmsCollection<CmsProject>('projects', { depth: '1' }, props.projects);

    const title = partner?.title || t.partner.fallbackTitle;
    const intro = partner?.intro || t.partner.fallbackLead;
    const photo = mediaUrl(partner?.heroImage, 'large') || HEAD_PHOTO;
    const email = partner?.contactEmail || siteConfig.email;
    // Same steps as the homepage; a CMS step's button anchors to this page's
    // booking section instead.
    const processSteps = buildProcessSteps(hp?.steps, t.process.steps, '#partner-book');
    const ngoQuestions = (faq ?? []).filter(
        (item) => item.category === 'projects' || item.category === 'general'
    );

    return (
        <div className="lp">
            <div className="lp-page lp-page--ngos">
                <div className="lp-inner">
                    <div className="lp-split-head">
                        <motion.div
                            className="lp-page__head"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <p className="lp-kicker">{t.partner.kicker}</p>
                            <h1 className="lp-page__title">{title}</h1>
                            <p className="lp-lead">{intro}</p>
                            {/* Who we are and what we do – context for the question above. */}
                            <p className="lp-page__about">{t.partner.about}</p>
                            <div className="lp-page__actions">
                                <a
                                    className="lp-btn lp-btn--primary"
                                    href="#partner-book"
                                    onClick={scrollTo('partner-book')}
                                    data-cta="ngo-book-head"
                                >
                                    {t.partner.talkCta} →
                                </a>
                                <a className="lp-btn lp-btn--ghost" href="#references" onClick={scrollTo('references')}>
                                    {p.ngoProjectsCta}
                                </a>
                            </div>
                        </motion.div>
                        <motion.figure
                            className="lp-split-head__photo"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                        >
                            <img src={photo} alt={t.join.expect.items.projects.alt} />
                        </motion.figure>
                    </div>
                </div>
            </div>

            {/* ---- Press and awards, compact so they are in view on the first screen ---- */}
            <Recognition projects={projects} variant="band" />

            {/* ---- References: what we have built ---- */}
            {(projects?.length ?? 0) > 0 && (
                <section id="references" className="lp-section lp-refs">
                    <div className="lp-inner">
                        <motion.div className="lp-head lp-head--split" {...reveal} transition={{ duration: 0.5 }}>
                            <div className="lp-head__copy">
                                <p className="lp-kicker">{p.ngoRefsLabel}</p>
                                <h2 className="lp-h2">{p.ngoRefsTitle}</h2>
                            </div>
                            <Link className="lp-textlink" href="/projects">
                                {t.projects.viewAll} →
                            </Link>
                        </motion.div>
                        <ProjectShowcase projects={projects ?? []} />
                    </div>
                </section>
            )}

            {/* ---- What NGOs say (CMS: Homepage → Voices, speaker "NGO") ---- */}
            <Testimonials items={hp?.testimonials} audience="ngo" />

            {/* ---- The facts an NGO decides on: a figure and one line each ---- */}
            <section className="lp-section lp-keyfacts-band">
                <div className="lp-inner">
                    <motion.div className="lp-head" {...reveal} transition={{ duration: 0.5 }}>
                        <p className="lp-kicker">{p.ngoFactsLabel}</p>
                        <h2 className="lp-h2">{p.ngoFactsTitle}</h2>
                    </motion.div>
                    <motion.dl className="lp-keyfacts" {...reveal} transition={{ duration: 0.5 }}>
                        {p.ngoFacts.map((fact) => (
                            <div className="lp-keyfact" key={fact.label}>
                                <dt className="lp-keyfact__label">{fact.label}</dt>
                                <dd className="lp-keyfact__value">{fact.value}</dd>
                                <dd className="lp-keyfact__note">{fact.note}</dd>
                            </div>
                        ))}
                    </motion.dl>
                </div>
            </section>

            {/* ---- The model: how a project runs (shared with the homepage) ---- */}
            <ProcessSteps
                id="process"
                kicker={hp?.processKicker || t.landing.labels.process}
                heading={hp?.processHeading || t.process.heading}
                intro={hp?.processIntro || t.process.intro}
                steps={processSteps}
                cta={{ label: t.partner.talkCta, href: '#partner-book' }}
            />

            {/* ---- Questions from NGOs ---- */}
            {ngoQuestions.length > 0 && (
                <section className="lp-section lp-faq-band">
                    <div className="lp-inner">
                        <motion.div className="lp-head lp-head--split" {...reveal} transition={{ duration: 0.5 }}>
                            <div className="lp-head__copy">
                                <p className="lp-kicker">~/faq</p>
                                <h2 className="lp-h2">{p.faq.ngoTitle}</h2>
                            </div>
                            <Link className="lp-textlink" href="/qa">
                                {p.faq.all} →
                            </Link>
                        </motion.div>
                        <FaqList items={ngoQuestions} />
                    </div>
                </section>
            )}

            {/* ---- Book a first talk (the page's main action) ---- */}
            <section id="partner-book" className="lp-section lp-book">
                <div className="lp-inner">
                    <motion.div className="lp-head" {...reveal} transition={{ duration: 0.5 }}>
                        <p className="lp-kicker">{p.ngoBookLabel}</p>
                        <h2 className="lp-h2">{partner?.ctaHeading || p.ngoBookTitle}</h2>
                        <p className="lp-lead">{partner?.ctaText || p.ngoBookText}</p>
                    </motion.div>
                    <div className="lp-book__embed">
                        <BookingEmbed />
                    </div>
                    <p className="lp-book__note">
                        {email && (
                            <>
                                <a className="lp-textlink" href={`mailto:${email}`}>
                                    {email}
                                </a>
                                <span aria-hidden="true">·</span>
                            </>
                        )}
                        <Link className="lp-textlink" href="/contact">
                            {t.contact.title}
                        </Link>
                    </p>
                </div>
            </section>

            <ClosingCta homepage={props.homepage} />
        </div>
    );
};

export default Partner;
