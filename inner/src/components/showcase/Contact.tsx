'use client';
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSiteConfig, useCmsCollection } from '../../api';
import type { CmsForm as CmsFormDoc } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';
import CmsForm from '../forms/CmsForm';
import BookingEmbed from '../general/BookingEmbed';
import ClosingCta from './ClosingCta';
import './landing.css';

export interface ContactProps {
    forms?: CmsFormDoc[] | null;
}

const Contact: React.FC<ContactProps> = (props) => {
    const siteConfig = useSiteConfig();
    const { t } = useLanguage();

    // Forms are defined in the CMS (form-builder plugin). The contact page
    // renders the form titled "Contact", falling back to the first form.
    const { data: forms, loading, error } = useCmsCollection<CmsFormDoc>(
        'forms',
        undefined,
        props.forms
    );
    const form = useMemo(
        () => forms?.find((f) => f.title === 'Contact') ?? forms?.[0] ?? null,
        [forms]
    );

    return (
        <div className="lp">
            <div className="lp-page">
            <div className="lp-inner">
                <motion.div
                    className="lp-page__head"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <p className="lp-kicker">{t.nav.contact}</p>
                    <h1 className="lp-page__title">{t.contact.title}</h1>
                    <p className="lp-lead">{t.contact.intro}</p>
                </motion.div>

                {(siteConfig.socialLinks ?? []).length > 0 && (
                    <div className="lp-socials">
                        {(siteConfig.socialLinks ?? []).map((link) => (
                            <a
                                key={link.platform}
                                className="lp-social"
                                rel="noreferrer"
                                target="_blank"
                                href={link.url}
                            >
                                {link.platform}
                            </a>
                        ))}
                    </div>
                )}

                <div className="lp-contact">
                    <p className="lp-contact__intro">
                        <b>Email: </b>
                        <a className="lp-social" href={`mailto:${siteConfig.email}`}>
                            {siteConfig.email}
                        </a>
                    </p>

                    {loading && <p className="lp-loading">{t.contact.loadingForm}</p>}

                    {!loading && (error || !form) && (
                        <p className="lp-empty">{t.contact.formUnavailable}</p>
                    )}

                    {!loading && form && (
                        <CmsForm form={form} conversion="contact" />
                    )}
                </div>

                <section id="book" className="lp-section--book" style={{ marginTop: 56, paddingTop: 40 }}>
                    <h2 className="lp-page__title" style={{ fontSize: 28 }}>
                        {t.book.title}
                    </h2>
                    <p className="lp-lead" style={{ marginBottom: 24 }}>
                        {t.book.intro}
                    </p>
                    <BookingEmbed />
                </section>
            </div>
            </div>
            <ClosingCta />
        </div>
    );
};

export default Contact;
