'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { useCmsCollection, useCmsGlobal } from '../../api';
import type { CmsFaqItem, CmsHomepage } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import FaqList from './FaqList';
import ClosingCta from './ClosingCta';
import './landing.css';

const reveal = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
} as const;

/** The order the groups appear in; questions without a category go last. */
const GROUPS = ['projects', 'membership', 'general', 'technical'] as const;

/**
 * /qa: every question from the CMS FAQ collection, grouped by its category –
 * NGO questions first, then the ones about joining. The head's copy comes
 * from the Homepage global (Section headers → Q&A) and falls back to i18n.
 */
const FaqPage: React.FC<{ faq?: CmsFaqItem[] | null; homepage?: CmsHomepage | null }> = (props) => {
    const { t } = useLanguage();
    const { data: faq } = useCmsCollection<CmsFaqItem>('faq', undefined, props.faq);
    const { data: hp } = useCmsGlobal<CmsHomepage>('homepage', props.homepage);
    const items = faq ?? [];

    const groups = [
        ...GROUPS.map((key) => ({
            key,
            label: t.pages.faq.groups[key],
            items: items.filter((item) => item.category === key),
        })),
        {
            key: 'other',
            label: '',
            items: items.filter(
                (item) => !GROUPS.includes(item.category as (typeof GROUPS)[number])
            ),
        },
    ].filter((group) => group.items.length > 0);

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
                        <p className="lp-kicker">{hp?.qaSubtitle || t.qa.subtitle}</p>
                        <h1 className="lp-page__title">{hp?.qaTitle || t.qa.title}</h1>
                        <p className="lp-lead">{hp?.qaIntro || t.qa.intro}</p>
                    </motion.div>

                    {groups.map((group) => (
                        <motion.section
                            key={group.key}
                            className="lp-faq-group"
                            {...reveal}
                            transition={{ duration: 0.45 }}
                        >
                            {group.label && <h2 className="lp-faq-group__title">{group.label}</h2>}
                            <FaqList items={group.items} />
                        </motion.section>
                    ))}
                </div>
            </div>
            <ClosingCta homepage={props.homepage} />
        </div>
    );
};

export default FaqPage;
