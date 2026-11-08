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

    const socials = siteConfig.socialLinks ?? [];

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

                    {/* The form on the left, the other ways in beside it. */}
                    <div className="lp-contact-grid">
                        <div className="lp-contact">
                            {loading && <p className="lp-loading">{t.contact.loadingForm}</p>}
                            {!loading && (error || !form) && (
                                <p className="lp-empty">{t.contact.formUnavailable}</p>
                            )}
                            {!loading && form && <CmsForm form={form} conversion="contact" />}
                        </div>
                        <aside className="lp-contact-aside">
                            <h2 className="lp-contact-aside__title">{t.pages.contactAsideTitle}</h2>
                            {siteConfig.email && (
                                <p className="lp-contact-aside__row">
                                    <span className="lp-contact-aside__label">Email</span>
                                    <a className="lp-textlink" href={`mailto:${siteConfig.email}`}>
                                        {siteConfig.email}
                                    </a>
                                </p>
                            )}
                            {socials.map((link) => (
                                <p className="lp-contact-aside__row" key={link.platform}>
                                    <span className="lp-contact-aside__label">{link.platform}</span>
                                    <a className="lp-textlink" rel="noreferrer" target="_blank" href={link.url}>
                                        {link.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                                    </a>
                                </p>
                            ))}
                            <p className="lp-contact-aside__row">
                                <span className="lp-contact-aside__label">{t.book.title}</span>
                                <a
                                    className="lp-textlink"
                                    href="#book"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        document.getElementById('book')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }}
                                >
                                    {t.book.pickTime} ↓
                                </a>
                            </p>
                        </aside>
                    </div>

                    <section id="book" className="lp-book lp-book--inline">
                        <div className="lp-head">
                            <h2 className="lp-h2">{t.book.title}</h2>
                            <p className="lp-lead">{t.book.intro}</p>
                        </div>
                        <div className="lp-book__embed">
                            <BookingEmbed />
                        </div>
                    </section>
                </div>
            </div>
            <ClosingCta />
        </div>
    );
};

export default Contact;
