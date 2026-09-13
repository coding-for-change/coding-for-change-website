'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCmsGlobal, useCmsCollection, mediaUrl } from '../../api';
import type { CmsForm as CmsFormDoc, CmsTechTour, CmsTechTourEvent } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';
import CmsForm from '../forms/CmsForm';
import ClosingCta from './ClosingCta';
import './landing.css';

const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
} as const;

/** The registration form is the form-builder form titled "techtour". */
const FORM_TITLE = 'techtour';

export interface TechTourProps {
    techTour?: CmsTechTour | null;
    forms?: CmsFormDoc[] | null;
    /** Request time from the server component; see BecomeAMember for why. */
    serverNow?: number;
}

/**
 * The Munich TechTour page: a week of evening visits to Munich tech companies,
 * open to every student. Copy and the visits come from the `tech-tour` global;
 * the registration form (which evenings, the attendance commitment, and the
 * optional "also apply for membership" box) is defined in the CMS and rendered
 * by the shared CmsForm.
 */
const TechTour: React.FC<TechTourProps> = (props) => {
    const { t, locale } = useLanguage();
    const { data: tt } = useCmsGlobal<CmsTechTour>('tech-tour', props.techTour);
    const {
        data: forms,
        loading: formsLoading,
        error: formsError,
    } = useCmsCollection<CmsFormDoc>('forms', undefined, props.forms);
    const form = useMemo(
        () => forms?.find((f) => f.title.trim().toLowerCase() === FORM_TITLE) ?? null,
        [forms]
    );

    const [now, setNow] = useState(() => props.serverNow ?? Date.now());
    useEffect(() => {
        setNow(Date.now());
    }, []);

    const deadline = tt?.registrationDeadline ? new Date(tt.registrationDeadline) : null;
    const open =
        (tt?.registrationOpen ?? true) &&
        (!deadline || Number.isNaN(deadline.getTime()) || now <= deadline.getTime());

    const dateLocale = locale === 'de' ? 'de-DE' : 'en-GB';
    const fmtDay = (iso: string) =>
        new Date(iso).toLocaleDateString(dateLocale, { weekday: 'long' });
    const fmtDate = (iso: string) =>
        new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });
    const fmtDeadline = (d: Date) =>
        d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });

    const events = useMemo(
        () =>
            [...(tt?.events ?? [])].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            ),
        [tt]
    );
    const highlights = tt?.highlights ?? [];

    const kicker = tt?.kicker || t.techtour.kicker;
    const title = tt?.title || t.techtour.fallbackTitle;
    const intro = tt?.intro || t.techtour.fallbackLead;
    const heroImage = mediaUrl(tt?.heroImage);

    const scrollToForm = (e: React.MouseEvent) => {
        const el = document.getElementById('techtour-form');
        if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const renderEvent = (ev: CmsTechTourEvent, i: number) => {
        const tba = ev.status === 'tba';
        const logo = mediaUrl(ev.logo);
        // `company` is not localised in the CMS, so a placeholder slot always
        // shows the translated "to be announced" instead of whatever was typed.
        const company = tba ? t.techtour.tbaCompany : ev.company;
        const heading = ev.title || company;
        return (
            <motion.li
                key={ev.id ?? i}
                className={`lp-tt-day${tba ? ' lp-tt-day--tba' : ''}`}
                {...reveal}
                transition={{ duration: 0.45, delay: Math.min(i * 0.08, 0.4) }}
            >
                <div className="lp-tt-day__when">
                    <span className="lp-tt-day__weekday">{fmtDay(ev.date)}</span>
                    <span className="lp-tt-day__date">{fmtDate(ev.date)}</span>
                </div>
                <div className="lp-tt-day__logo" aria-hidden={!logo}>
                    {logo ? (
                        <img src={logo} alt={`${company} logo`} loading="lazy" />
                    ) : (
                        <span className="lp-tt-day__initial">
                            {tba ? '?' : company.trim().charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>
                <div className="lp-tt-day__body">
                    <h3 className="lp-tt-day__title">
                        {ev.website && !tba ? (
                            <a href={ev.website} target="_blank" rel="noopener noreferrer">
                                {heading}
                            </a>
                        ) : (
                            heading
                        )}
                    </h3>
                    {ev.title && !tba && (
                        <p className="lp-tt-day__company">{company}</p>
                    )}
                    <p className="lp-tt-day__meta">
                        <span>{ev.time || t.techtour.tbaTime}</span>
                        <span className="lp-tt-day__sep" aria-hidden="true">·</span>
                        <span>{ev.location || t.techtour.tbaLocation}</span>
                    </p>
                    {ev.description && <p className="lp-tt-day__text">{ev.description}</p>}
                    {ev.status === 'tentative' && (
                        <span className="lp-tt-day__badge">{t.techtour.tentative}</span>
                    )}
                </div>
            </motion.li>
        );
    };

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
                    <p className="lp-kicker">{kicker}</p>
                    <h1 className="lp-page__title">{title}</h1>
                    <p className="lp-lead">{intro}</p>
                    <div className="lp-page__actions">
                        <span
                            className={`lp-round-status${
                                open ? ' lp-round-status--open' : ' lp-round-status--closed'
                            }`}
                        >
                            <span className="lp-round-status__dot" aria-hidden="true" />
                            {open ? t.techtour.statusOpen : t.techtour.statusClosed}
                            {deadline && !Number.isNaN(deadline.getTime()) && (
                                <>
                                    <span className="lp-round-status__sep" aria-hidden="true">
                                        ·
                                    </span>
                                    {t.techtour.deadlinePrefix} {fmtDeadline(deadline)}
                                </>
                            )}
                        </span>
                        {open && (
                            <a
                                className="lp-btn lp-btn--primary"
                                href="#techtour-form"
                                onClick={scrollToForm}
                            >
                                {t.techtour.registerCta} ↓
                            </a>
                        )}
                    </div>
                </motion.div>

                {heroImage && (
                    <motion.div
                        className="lp-page__hero"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <img src={heroImage} alt={title} />
                    </motion.div>
                )}

                {/* ---- The week: one visit per evening ---- */}
                {events.length > 0 && (
                    <>
                        <motion.div className="lp-join-phase" {...reveal} transition={{ duration: 0.5 }}>
                            <p className="lp-kicker">{t.techtour.scheduleKicker}</p>
                            <h2 className="lp-h2">{t.techtour.scheduleHeading}</h2>
                            <p className="lp-lead">{t.techtour.scheduleIntro}</p>
                        </motion.div>
                        <ol className="lp-tt-days">{events.map(renderEvent)}</ol>
                    </>
                )}

                {/* ---- What you get ---- */}
                {highlights.length > 0 && (
                    <motion.div
                        className="lp-tracks lp-tt-highlights"
                        {...reveal}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="lp-subhead">{t.techtour.highlightsHeading}</h2>
                        <div className="lp-grid">
                            {highlights.map((h, i) => (
                                <div className="lp-card" key={h.id ?? i}>
                                    <h3 className="lp-card__title">{h.title}</h3>
                                    <p className="lp-card__text">{h.text}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ---- Registration ---- */}
                <motion.div
                    className="lp-form lp-form--wide"
                    id="techtour-form"
                    {...reveal}
                    transition={{ duration: 0.5 }}
                >
                    {tt?.commitment && (
                        <aside className="lp-tt-commit">
                            <p className="lp-tt-commit__head">{t.techtour.commitmentHeading}</p>
                            <p className="lp-tt-commit__text">{tt.commitment}</p>
                        </aside>
                    )}
                    {open ? (
                        <>
                            {formsLoading && <p className="lp-loading">{t.join.loadingForm}</p>}
                            {!formsLoading && (formsError || !form) && (
                                <p className="lp-empty">{t.techtour.formUnavailable}</p>
                            )}
                            {!formsLoading && form && (
                                <CmsForm
                                    form={form}
                                    conversion="techtour"
                                    heading={tt?.formHeading || t.techtour.formHeading}
                                />
                            )}
                        </>
                    ) : (
                        <>
                            <h3 className="lp-col__head" style={{ marginBottom: 8 }}>
                                {t.techtour.statusClosed}
                            </h3>
                            <p className="lp-lead">{tt?.closedMessage || t.techtour.closedFallback}</p>
                        </>
                    )}
                    <p className="lp-form-note lp-tt-also">
                        <Link href="/join">{t.techtour.alsoApply}</Link>
                    </p>
                </motion.div>
            </div>
            </div>
            <ClosingCta />
        </div>
    );
};

export default TechTour;
