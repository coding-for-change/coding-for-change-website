'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { mediaUrl } from '../../api';
import type { CmsTestimonial, TestimonialAudience } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import { placeholderQuotes } from '../../lib/placeholderQuotes';
import './landing.css';

const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
} as const;

const initials = (name?: string | null) =>
    (name ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');

const Attribution: React.FC<{ item: CmsTestimonial }> = ({ item }) => {
    const photo = typeof item.photo === 'object' ? mediaUrl(item.photo, 'thumbnail') : null;
    const role = [item.role, item.organisation].filter(Boolean).join(', ');
    if (!item.name && !role) return null;
    return (
        <figcaption className="lp-voice__who">
            {photo ? (
                <img className="lp-voice__photo" src={photo} alt="" loading="lazy" />
            ) : (
                item.name && (
                    <span className="lp-voice__photo lp-voice__photo--initials" aria-hidden="true">
                        {initials(item.name)}
                    </span>
                )
            )}
            <span className="lp-voice__meta">
                {item.name && <span className="lp-voice__name">{item.name}</span>}
                {role && <span className="lp-voice__role">{role}</span>}
            </span>
        </figcaption>
    );
};

/**
 * Voices from partner NGOs, companies and members (CMS: Homepage → Voices),
 * under a head like every other section, the first one large. The homepage shows them all; /ngos and /partners pass
 * an `audience` and show only the NGOs' or the companies' quotes. Only real quotes go live: with none in the CMS the
 * section is left out of a production build. In development invented
 * placeholders stand in (lib/placeholderQuotes.ts), so the layout can be
 * judged before the first quote is entered.
 */
const Testimonials: React.FC<{
    items?: CmsTestimonial[] | null;
    bandColor?: string;
    audience?: TestimonialAudience;
}> = ({ items, bandColor, audience }) => {
    const { t, locale } = useLanguage();
    const all: CmsTestimonial[] = items?.length
        ? items
        : process.env.NODE_ENV !== 'production'
          ? placeholderQuotes(locale)
          : [];
    const quotes = audience ? all.filter((item) => item.audience === audience) : all;
    if (quotes.length === 0) return null;

    const mark = (text: string) => (locale === 'de' ? `„${text}“` : `“${text}”`);
    const [lead, ...rest] = quotes;

    return (
        <section className="lp-section lp-voices" data-bg={bandColor}>
            <div className="lp-inner">
                <motion.div className="lp-head" {...reveal} transition={{ duration: 0.5 }}>
                    <p className="lp-kicker">{t.pages.voicesLabel}</p>
                    <h2 className="lp-h2">{t.pages.voicesTitle}</h2>
                </motion.div>
                <motion.figure className="lp-voice lp-voice--lead" {...reveal} transition={{ duration: 0.5 }}>
                    <blockquote className="lp-voice__quote">{mark(lead.quote)}</blockquote>
                    <Attribution item={lead} />
                </motion.figure>
                {rest.length > 0 && (
                    <div className="lp-voices__grid">
                        {rest.map((item, i) => (
                            <motion.figure
                                key={item.id ?? `${i}-${item.name}`}
                                className="lp-voice"
                                {...reveal}
                                transition={{ duration: 0.5, delay: 0.08 * (i + 1) }}
                            >
                                <blockquote className="lp-voice__quote">{mark(item.quote)}</blockquote>
                                <Attribution item={item} />
                            </motion.figure>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};

export default Testimonials;
