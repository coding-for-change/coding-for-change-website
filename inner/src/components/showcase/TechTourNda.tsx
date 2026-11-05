'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';
import useDarkNav from '../../hooks/useDarkNav';
import { MCKINSEY_NDA, type NdaVersion } from '../../data/mckinseyNda';
import './landing.css';
import './techtourApply.css';
import './techtourManage.css';
import './techtourNda.css';

/**
 * /techtour/mckinsey-nda – McKinsey's confidentiality agreement for its Tech
 * Tour evening, in full: the German translation and the English original, the
 * page's language first. Accepting it is the tick box on /techtour/manage (the
 * evening's to-do in the CMS links here); this page only shows the text. Same
 * dark stage as the manage page.
 */
const TechTourNda: React.FC = () => {
    const { t, locale } = useLanguage();
    const n = t.techtourNda;
    useDarkNav();

    const order: ('de' | 'en')[] = locale === 'de' ? ['de', 'en'] : ['en', 'de'];
    const name = { de: n.german, en: n.english };

    const renderVersion = (lang: 'de' | 'en', doc: NdaVersion) => (
        <section key={lang} id={lang} className="ttn-doc" lang={lang}>
            <h2 className="ttn-doc__title">{doc.title}</h2>
            {doc.note && <p className="ttn-doc__note">{doc.note}</p>}
            {doc.paragraphs.map((p, i) => (
                <p key={i} className="ttn-doc__p">
                    {p}
                </p>
            ))}
            <div className="ttn-fields">
                {doc.fieldsNote && <p className="ttn-fields__note">{doc.fieldsNote}</p>}
                {doc.fields.map((f) => (
                    <p key={f} className="ttn-field">
                        <span className="ttn-field__label">{f}</span>
                        <span className="ttn-field__line" aria-hidden="true" />
                    </p>
                ))}
            </div>
        </section>
    );

    return (
        <div className="lp lp--techtour tta ttm ttn">
            <div className="lp-page lp-tt-stage">
                <div className="lp-inner tta-col">
                    <motion.div
                        className="lp-page__head lp-tt-head tta-head"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <p className="lp-kicker">{n.kicker}</p>
                        <h1 className="lp-page__title">{n.title}</h1>
                        <p className="ttm-lead">{n.lead}</p>
                        <p className="ttn-jump">
                            {n.versions}{' '}
                            {order.map((lang, i) => (
                                <React.Fragment key={lang}>
                                    {i > 0 && ' · '}
                                    <a href={`#${lang}`}>{name[lang]}</a>
                                </React.Fragment>
                            ))}
                        </p>
                    </motion.div>

                    <motion.div
                        className="ttn-body"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        {order.map((lang) => renderVersion(lang, MCKINSEY_NDA[lang]))}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default TechTourNda;
