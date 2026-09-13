'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useCmsGlobal, useCmsCollection, submitWaitlist, mediaUrl } from '../../api';
import type { CmsForm as CmsFormDoc } from '../../api';
import { CmsMembership } from '../../api/types';
import { getAttribution } from '../../lib/attribution';
import { trackFormStart, trackConversion } from '../../lib/analytics';
import { trackAdsConversion } from '../../lib/googleAds';
import { useLanguage } from '../../contexts/LanguageContext';
import CmsForm from '../forms/CmsForm';
import ClosingCta from './ClosingCta';
import ProcessTimeline from './ProcessTimeline';
import {
    APPLICATION_STEPS,
    applicationsOpen,
    daysUntilDeadline,
    stepState,
} from '../../lib/applicationPhase';
import './landing.css';

const validateEmail = (email: string) => {
    const re =
        // eslint-disable-next-line
        /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
};

// Whether membership applications are open is decided by the round's deadline
// in `lib/applicationPhase.ts`. While closed, the page shows a "notify me when
// applications reopen" email signup (persisted to the CMS `waitlist-signups`
// collection) instead of the application form. The form itself — every
// question, the CV upload, the "also register for the TechTour" box — is
// defined in the CMS and rendered by the shared `CmsForm`.

const BecomeAMember: React.FC<{
    membership?: CmsMembership | null;
    forms?: CmsFormDoc[] | null;
    /**
     * Request time from the server component. Seeding the clock with it keeps
     * the server and first client render identical (no hydration mismatch on
     * the open/closed state or the day count); the client clock takes over
     * after mount.
     */
    serverNow?: number;
}> = (props) => {
    const { data: membership, loading } = useCmsGlobal<CmsMembership>(
        'membership',
        props.membership
    );
    const { t, locale } = useLanguage();

    const [now, setNow] = useState(() => props.serverNow ?? Date.now());
    useEffect(() => {
        setNow(Date.now());
    }, []);
    const open = applicationsOpen(now);
    const daysLeft = daysUntilDeadline(now);
    const phaseSteps = useMemo(
        () =>
            APPLICATION_STEPS.map((step) => ({
                ...t.join.phase.steps[step.id],
                state: stepState(step, now),
            })),
        [t, now]
    );

    const scrollToForm = (e: React.MouseEvent) => {
        const el = document.getElementById('join-form');
        if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // Waitlist ("notify me when applications reopen") state — used while the
    // round is closed. Emails persist to the CMS waitlist-signups collection
    // via submitWaitlist().
    const [waitlistEmail, setWaitlistEmail] = useState('');
    const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
    const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
    const [waitlistError, setWaitlistError] = useState(false);

    const waitlistValid = validateEmail(waitlistEmail);

    const handleWaitlistSubmit = async () => {
        if (!waitlistValid || waitlistSubmitting) return;
        setWaitlistError(false);
        setWaitlistSubmitting(true);
        try {
            await submitWaitlist(waitlistEmail.trim(), locale, getAttribution());
            setWaitlistSubmitted(true);
            trackConversion('waitlist');
            trackAdsConversion('waitlist');
        } catch {
            setWaitlistError(true);
        } finally {
            setWaitlistSubmitting(false);
        }
    };

    // Forms are defined in the CMS (form-builder plugin). The join page
    // renders the form titled "application", falling back to the first form.
    const {
        data: forms,
        loading: formsLoading,
        error: formsError,
    } = useCmsCollection<CmsFormDoc>('forms', undefined, props.forms);
    const form = useMemo(
        () => forms?.find((f) => f.title === 'application') ?? forms?.[0] ?? null,
        [forms]
    );

    // Funnel: the waitlist signup fires `form_start` on first focus; the
    // application form tracks its own start inside CmsForm.
    const waitlistStarted = useRef(false);
    const handleWaitlistFocus = () => {
        if (open || waitlistStarted.current) return;
        waitlistStarted.current = true;
        trackFormStart('waitlist');
    };

    if (loading) {
        return (
            <div className="lp lp-page">
                <div className="lp-inner">
                    <p className="lp-loading">Loading…</p>
                </div>
            </div>
        );
    }

    if (!membership) {
        return (
            <div className="lp lp-page">
                <div className="lp-inner">
                    <p className="lp-empty">{t.join.unavailable}</p>
                </div>
            </div>
        );
    }

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
                    <p className="lp-kicker">{t.nav.join}</p>
                    <h1 className="lp-page__title">{membership.title}</h1>
                    <p className="lp-lead">{membership.description}</p>
                    <div className="lp-page__actions">
                        <span
                            className={`lp-round-status${
                                open ? ' lp-round-status--open' : ' lp-round-status--closed'
                            }`}
                        >
                            <span className="lp-round-status__dot" aria-hidden="true" />
                            {open ? t.join.statusOpen : t.join.statusClosed}
                            <span className="lp-round-status__sep" aria-hidden="true">
                                ·
                            </span>
                            {open
                                ? daysLeft <= 1
                                    ? t.join.lastDay
                                    : t.join.daysLeft.replace(
                                          '{n}',
                                          String(daysLeft)
                                      )
                                : t.join.statusDeadline}
                        </span>
                        <a
                            className="lp-btn lp-btn--primary"
                            href="#join-form"
                            onClick={scrollToForm}
                        >
                            {open ? t.join.toForm : t.join.waitlistButton} ↓
                        </a>
                    </div>
                </motion.div>

                {mediaUrl(membership.heroImage) && (
                    <motion.div
                        className="lp-page__hero"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <img
                            src={mediaUrl(membership.heroImage) || ''}
                            alt={membership.title}
                        />
                    </motion.div>
                )}

                {(membership.tracks ?? []).length > 0 && (
                    <motion.div
                        className="lp-tracks"
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="lp-subhead">
                            {t.join.waysToContribute}
                        </h2>
                        <div className="lp-grid">
                            {(membership.tracks ?? []).map((track, i) => (
                                <div className="lp-card" key={track.id ?? i}>
                                    <h3 className="lp-card__title">
                                        {track.title}
                                    </h3>
                                    <p className="lp-card__text">
                                        {track.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                <motion.div
                    className="lp-cols2"
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.15 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="lp-col">
                        <h3 className="lp-col__head">{t.join.benefits}</h3>
                        <ul className="lp-list">
                            {(membership.benefits ?? []).map((b, i) => (
                                <li key={i}>{b.text}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="lp-col">
                        <h3 className="lp-col__head">{t.join.requirements}</h3>
                        <ul className="lp-list">
                            {(membership.requirements ?? []).map((r, i) => (
                                <li key={i}>{r.text}</li>
                            ))}
                        </ul>
                    </div>
                </motion.div>

                <motion.div
                    className="lp-join-phase lp-join-phase--spaced"
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.15 }}
                    transition={{ duration: 0.5 }}
                >
                    <p className="lp-kicker">{t.join.phase.kicker}</p>
                    <h2 className="lp-h2">{t.join.phase.heading}</h2>
                    <p className="lp-lead">{t.join.phase.intro}</p>
                </motion.div>
                <ProcessTimeline className="lp-tl--cs lp-tl--join" steps={phaseSteps} />

                <motion.div
                    className="lp-form"
                    id="join-form"
                    onFocus={handleWaitlistFocus}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.15 }}
                    transition={{ duration: 0.5 }}
                >
                    {open ? (
                      <>
                        {formsLoading && (
                            <p className="lp-loading">{t.join.loadingForm}</p>
                        )}
                        {!formsLoading && (formsError || !form) && (
                            <p className="lp-empty">{t.join.formUnavailable}</p>
                        )}
                        {!formsLoading && form && (
                            <CmsForm
                                form={form}
                                conversion="application"
                                heading={t.join.applyNow}
                            />
                        )}
                      </>
                    ) : (
                      <>
                        <h3
                            className="lp-col__head"
                            style={{ marginBottom: 8 }}
                        >
                            {t.join.waitlistTitle}
                        </h3>
                        <p className="lp-lead" style={{ marginBottom: 20 }}>
                            {t.join.waitlistLead}
                        </p>

                        {waitlistSubmitted ? (
                            <div className="lp-field">
                                <p>{t.join.waitlistSuccess}</p>
                            </div>
                        ) : (
                            <>
                                <div className="lp-field">
                                    <span className="lp-label">
                                        {t.join.waitlistEmailLabel}
                                    </span>
                                    <input
                                        className="lp-input"
                                        type="email"
                                        placeholder={
                                            t.join.waitlistEmailPlaceholder
                                        }
                                        value={waitlistEmail}
                                        onChange={(e) =>
                                            setWaitlistEmail(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter')
                                                handleWaitlistSubmit();
                                        }}
                                    />
                                </div>
                                <button
                                    className="lp-submit"
                                    type="button"
                                    disabled={
                                        !waitlistValid || waitlistSubmitting
                                    }
                                    onMouseDown={handleWaitlistSubmit}
                                >
                                    {waitlistSubmitting
                                        ? t.join.waitlistSubmitting
                                        : t.join.waitlistButton}
                                </button>
                                <p className="lp-form-note">
                                    {waitlistError ? (
                                        <span className="lp-required">
                                            {t.join.waitlistError}
                                        </span>
                                    ) : (
                                        '\xa0'
                                    )}
                                </p>
                            </>
                        )}
                      </>
                    )}
                </motion.div>

            </div>
            </div>
            <ClosingCta />
        </div>
    );
};

export default BecomeAMember;
