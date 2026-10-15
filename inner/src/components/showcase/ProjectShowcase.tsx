'use client';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { mediaUrl } from '../../api';
import { CmsProject } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import { hasCaseStudy } from '../../lib/projects';
import './landing.css';

const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
} as const;

// Defined in lib/projects.ts (the Team page needs it too); re-exported here
// because this is where callers have always imported it from.
export { hasCaseStudy };

/**
 * One project as a picture of the product: its interface on a tinted stage –
 * the desktop screenshot in a browser window, the phone screenshot in a bezel
 * in front of it – under a head with the partner's logo, the project title
 * and the partner's name. The story lives on the case study; a tile with
 * one links there.
 */
const ProjectTile: React.FC<{ project: CmsProject; wide: boolean; index: number }> = ({
    project,
    wide,
    index,
}) => {
    const { t, locale } = useLanguage();
    const logo = mediaUrl(project.image, 'thumbnail');
    const desktop = mediaUrl(project.screens?.desktop, 'large');
    const mobile = mediaUrl(project.screens?.mobile, 'large');
    const linked = hasCaseStudy(project);
    const shots = desktop && mobile ? 'pair' : desktop ? 'desktop' : mobile ? 'mobile' : 'none';

    const inner = (
        <div className={`lp-ptile__stage lp-ptile__stage--${shots}`}>
            {/* The head sits on the stage itself: logo, title and one line,
                with the way into the case study at the far end. */}
            <div className="lp-ptile__head">
                {logo && shots !== 'none' && (
                    <span className="lp-ptile__logo">
                        <img src={logo} alt={project.ngoPartner} />
                    </span>
                )}
                <div className="lp-ptile__text">
                    <h3 className="lp-ptile__title">{project.title}</h3>
                    <p className="lp-ptile__sub">{project.ngoPartner}</p>
                </div>
                {project.status === 'recruiting' && (
                    <span className="lp-ptile__badge">{t.projects.status.recruiting}</span>
                )}
                {linked && (
                    <span className="lp-ptile__more">
                        {locale === 'de' ? 'Mehr erfahren' : 'Learn more'}
                        <span aria-hidden> →</span>
                    </span>
                )}
            </div>
            {shots === 'none' ? (
                logo ? (
                    <span className="lp-ptile__solo-logo">
                        <img src={logo} alt="" />
                    </span>
                ) : (
                    <span className="lp-ptile__initial">{project.title.charAt(0)}</span>
                )
            ) : (
                <>
                    {desktop && (
                        <span className="lp-ptile__window">
                            <span className="lp-ptile__bar" aria-hidden>
                                <span />
                                <span />
                                <span />
                            </span>
                            <img src={desktop} alt="" loading="lazy" />
                        </span>
                    )}
                    {mobile && (
                        <span className="lp-ptile__phone">
                            <img src={mobile} alt="" loading="lazy" />
                        </span>
                    )}
                </>
            )}
        </div>
    );

    return (
        <motion.article
            className={'lp-ptile' + (wide ? ' lp-ptile--wide' : '') + (linked ? ' lp-ptile--linked' : '')}
            {...reveal}
            transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.3) }}
        >
            {linked ? (
                <Link className="lp-ptile__link" href={`/projects/${project.slug}`}>
                    {inner}
                </Link>
            ) : (
                <div className="lp-ptile__link">{inner}</div>
            )}
        </motion.article>
    );
};

/**
 * The projects as a grid of interface tiles, the flagship first and across the
 * full width. Shared by the /projects page and the homepage projects section.
 */
const ProjectShowcase: React.FC<{ projects: CmsProject[] }> = ({ projects }) => {
    const featured = projects.find((p) => p.featured) ?? null;
    const ordered = featured ? [featured, ...projects.filter((p) => p !== featured)] : projects;
    return (
        <div className="lp-pgrid">
            {ordered.map((project, i) => (
                <ProjectTile
                    key={project.id}
                    project={project}
                    wide={project === featured}
                    index={i}
                />
            ))}
        </div>
    );
};

export default ProjectShowcase;
