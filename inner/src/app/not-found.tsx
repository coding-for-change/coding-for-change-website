'use client';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import SiteShell from '../components/general/SiteShell';
import ClosingCta from '../components/showcase/ClosingCta';
import '../components/showcase/landing.css';

/**
 * Global 404 page. It renders inside the root layout (which provides the
 * language + site-config context), so we wrap it in `SiteShell` to carry the
 * real nav + footer and append the shared `ClosingCta` — the 404 then reads
 * like a normal page of the site, localised to the visitor's selected language.
 */
export default function NotFound() {
    const { t } = useLanguage();

    return (
        <SiteShell>
            <div className="lp">
                <div className="lp-page">
                    <div className="lp-inner">
                        <motion.div
                            className="lp-page__head"
                            style={{ marginBottom: 0 }}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <p className="lp-kicker">{t.notFound.kicker}</p>
                            <h1 className="lp-page__title">{t.notFound.title}</h1>
                            <p className="lp-lead">{t.notFound.lead}</p>

                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 14,
                                    marginTop: 32,
                                }}
                            >
                                <Link className="lp-btn lp-btn--primary" href="/">
                                    {t.notFound.backHome}
                                </Link>
                            </div>

                            <p
                                className="lp-kicker"
                                style={{ margin: '44px 0 16px' }}
                            >
                                {t.notFound.helpfulLinks}
                            </p>
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 14,
                                }}
                            >
                                <Link className="lp-btn lp-btn--ghost" href="/projects">
                                    {t.notFound.projects}
                                </Link>
                                <Link className="lp-btn lp-btn--ghost" href="/ngos">
                                    {t.notFound.ngos}
                                </Link>
                                <Link className="lp-btn lp-btn--ghost" href="/join">
                                    {t.notFound.join}
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </div>
                <ClosingCta />
            </div>
        </SiteShell>
    );
}
