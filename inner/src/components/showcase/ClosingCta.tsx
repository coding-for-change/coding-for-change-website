'use client';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useCmsGlobal } from '../../api';
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
 * (falls back to i18n). Context-aware buttons: on /join the Join button scrolls
 * to the application/email form; on /ngos the partner button scrolls to the
 * booking tool; everywhere else they link to /join and /ngos.
 */
const ClosingCta: React.FC<ClosingCtaProps> = (props) => {
    const { t } = useLanguage();
    const { data: hp } = useCmsGlobal<CmsHomepage>('homepage', props.homepage);
    const pathname = usePathname() ?? '';

    const heading = hp?.ctaHeading || t.cta.heading;
    const text = hp?.ctaText || t.cta.text;
    const joinLabel = hp?.ctaJoin || t.cta.join;
    const partnerLabel = hp?.ctaContact || t.cta.contact;

    const onJoin = pathname.startsWith('/join');
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
                        {onJoin ? (
                            <a
                                className="lp-btn lp-btn--light"
                                href="#join-form"
                                onClick={scrollTo('join-form')}
                            >
                                {joinLabel}
                            </a>
                        ) : (
                            <Link className="lp-btn lp-btn--light" href="/join">
                                {joinLabel}
                            </Link>
                        )}
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
