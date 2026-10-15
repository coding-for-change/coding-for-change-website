'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';
import './join.css';

const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
} as const;

/** The three things a semester with us is made of, each with its photo. */
const EXPECT = [
    { id: 'projects', src: '/images/join/project-work.webp' },
    { id: 'community', src: '/images/join/community-events.webp' },
    { id: 'companies', src: '/images/join/company-visits.webp' },
] as const;

export interface JoinExpectProps {
    /** Overrides for the head (the homepage's CMS copy); blank falls back to `join.expect`. */
    heading?: string | null;
    lead?: string | null;
}

/**
 * "What to expect": the head and the bento of three tiles. Shared by /join
 * and the student-mode homepage — the caller supplies the section around it.
 */
const JoinExpect: React.FC<JoinExpectProps> = ({ heading, lead }) => {
    const { t } = useLanguage();
    return (
        <div className="lp-inner">
            <motion.div className="jn-head" {...reveal} transition={{ duration: 0.5 }}>
                <p className="lp-kicker">{t.join.expect.kicker}</p>
                <h2 className="lp-h2">{heading || t.join.expect.heading}</h2>
                <p className="lp-lead">{lead || t.join.expect.lead}</p>
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
    );
};

export default JoinExpect;
