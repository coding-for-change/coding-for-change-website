'use client';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useCmsGlobal, useHomepageMode } from '../../api';
import useNow from '../../hooks/useNow';
import { applicationStatus } from '../../lib/applicationPhase';
import { CmsHomepage } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import './landing.css';

const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
} as const;

export interface ClosingCtaProps {
    homepage?: CmsHomepage | null;
}

/**
 * Shared closing call-to-action band ("Ready to build something great?"), placed
 * at the bottom of every content page. Copy comes from the `homepage` global
 * (falls back to i18n). Context-aware: on /ngos the partner button scrolls to
 * the booking tool; everywhere else the buttons link to /join and /ngos. /join
 * has its own closing band, tied to the application round.
 *
 * While the homepage is in student mode (Site Configuration → Homepage
 * audience), this band borrows that one: the round's closing copy by its
 * status, and a button straight to /join/apply.
 */
const ClosingCta: React.FC<ClosingCtaProps> = (props) => {
    const { t } = useLanguage();
    const { data: hp } = useCmsGlobal<CmsHomepage>('homepage', props.homepage);
    const pathname = usePathname() ?? '';

    const students = useHomepageMode() === 'students';
    const status = applicationStatus(useNow());

    const heading = students ? t.join.closing.heading : hp?.ctaHeading || t.cta.heading;
    const text = students ? t.join.closing.text[status] : hp?.ctaText || t.cta.text;
    const joinLabel = students
        ? (status === 'open' && hp?.studentHeroCtaPrimary) || t.join.cta[status]
        : hp?.ctaJoin || t.cta.join;
    const joinHref = students ? '/join/apply' : '/join';
    const partnerLabel = hp?.ctaContact || t.cta.contact;

    const onPartner = pathname.startsWith('/ngos');

    const scrollTo = (id: string) => (e: React.MouseEvent) => {
        const el = document.getElementById(id);
        if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <section className="lp-cta">
            <div className="lp-inner">
                <motion.div style={{ display: 'block' }} {...reveal} transition={{ duration: 0.5 }}>
                    <h2 className="lp-cta__heading">{heading}</h2>
                    <p className="lp-cta__text">{text}</p>
                    <div className="lp-cta__btns">
                        <Link className="lp-btn lp-btn--light" href={joinHref}>
                            {joinLabel}
                        </Link>
                        {onPartner ? (
                            <a
                                className="lp-btn lp-btn--light"
                                href="#partner-book"
                                onClick={scrollTo('partner-book')}
                            >
                                {partnerLabel}
                            </a>
                        ) : (
                            <Link className="lp-btn lp-btn--light" href="/ngos">
                                {partnerLabel}
                            </Link>
                        )}
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default ClosingCta;
