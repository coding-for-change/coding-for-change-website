'use client';
import React, { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { CmsProject } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import { APPLICATION_ROUND } from '../../lib/applicationPhase';
import { hasCaseStudy } from '../../lib/projects';
import JoinSteps from './JoinSteps';
import './join.css';

const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
} as const;

/**
 * The project shown beside the steps: its screens on a laptop and a phone
 * (a still made from the case study's gallery) and a link to the case study.
 * Title, partner and impact line come from the CMS in the visitor's language;
 * without the project – or without a case study to link to – the steps run
 * on their own.
 */
const SHOWCASE_SLUG = 'lebenshilfe';
const SHOWCASE_IMAGE = '/images/join/lebenshilfe-showcase.webp';

export interface JoinProcessProps {
    /** Epoch ms the steps are drawn against (done / current / upcoming). */
    now: number;
    /** The projects, for the showcase beside the steps. */
    projects?: CmsProject[] | null;
}

/**
 * "Three steps to your first project": the head, the steps and the project
 * showcase. Shared by /join and the student-mode homepage — the caller
 * supplies the section around it (with `id="process"`, the hero's anchor).
 */
const JoinProcess: React.FC<JoinProcessProps> = ({ now, projects }) => {
    const { t, locale } = useLanguage();
    const round = APPLICATION_ROUND[locale];
    const showcase = useMemo(
        () => (projects ?? []).find((p) => p.slug === SHOWCASE_SLUG && hasCaseStudy(p)) ?? null,
        [projects]
    );
    return (
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
                            <Link className="jn-showcase__link" href={`/projects/${showcase.slug}`}>
                                {t.join.showcase.link} →
                            </Link>
                        </figcaption>
                    </motion.figure>
                )}
            </div>
        </div>
    );
};

export default JoinProcess;
