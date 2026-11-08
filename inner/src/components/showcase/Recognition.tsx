'use client';
import React from 'react';
import { motion } from 'framer-motion';
import type { CmsProject } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import './landing.css';

const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
} as const;

/**
 * The three recognitions, each a logo, one sentence (`pages.recognition`) and
 * a link: the press tile to the article from the project's press entry in
 * the CMS, the awards to their pages about us. Logos from our partner deck
 * (public/images/logos).
 */
const TILES = [
    { key: 'press', logo: '/images/logos/sueddeutsche-zeitung.png', outlet: 'süddeutsche zeitung' },
    {
        key: 'startsocial',
        logo: '/images/logos/startsocial.png',
        href: 'https://startsocial.de/stipendiaten-und-alumni-detail?id=3784',
    },
    {
        key: 'movers',
        logo: '/images/logos/movers-of-tomorrow.webp',
        href: 'https://movers-of-tomorrow-award.de/videos/code-statt-papierchaos-fuer-mehr-inklusion/',
    },
] as const;

/**
 * "Learn more about our impact": the press and our awards as compact tiles,
 * each saying in one sentence what it stands for. `band` sits straight under
 * a page head with a small title, so it is in view on the first screen
 * (/ngos); `section` is a regular band with the usual heading (/partners).
 */
const Recognition: React.FC<{ projects?: CmsProject[] | null; variant?: 'band' | 'section' }> = ({
    projects,
    variant = 'section',
}) => {
    const { t } = useLanguage();
    const p = t.pages;
    const press = (projects ?? []).flatMap((project) => project.press ?? []);
    const band = variant === 'band';

    return (
        <section className={'lp-section lp-recognition' + (band ? ' lp-recognition--band' : '')}>
            <div className="lp-inner">
                <motion.div className="lp-head" {...reveal} transition={{ duration: 0.5 }}>
                    <p className="lp-kicker">{p.recognitionLabel}</p>
                    <h2 className={band ? 'lp-recognition__title' : 'lp-h2'}>{p.recognitionTitle}</h2>
                </motion.div>
                <ul className="lp-recog">
                    {TILES.map((tile, i) => {
                        const href =
                            'href' in tile
                                ? tile.href
                                : press.find(
                                      (item) => item.url && item.outlet?.trim().toLowerCase() === tile.outlet
                                  )?.url;
                        const body = (
                            <>
                                <span className="lp-recog__logo">
                                    <img src={tile.logo} alt="" />
                                </span>
                                <span className="lp-recog__text">{p.recognition[tile.key]}</span>
                                {href && (
                                    <span className="lp-recog__arrow" aria-hidden="true">
                                        ↗
                                    </span>
                                )}
                            </>
                        );
                        return (
                            <motion.li key={tile.key} {...reveal} transition={{ duration: 0.45, delay: i * 0.06 }}>
                                {href ? (
                                    <a className="lp-recog__tile" href={href} target="_blank" rel="noreferrer">
                                        {body}
                                    </a>
                                ) : (
                                    <div className="lp-recog__tile">{body}</div>
                                )}
                            </motion.li>
                        );
                    })}
                </ul>
            </div>
        </section>
    );
};

export default Recognition;
