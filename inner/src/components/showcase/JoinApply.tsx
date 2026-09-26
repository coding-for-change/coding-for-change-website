'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCmsCollection, useCmsGlobal, useSiteConfig } from '../../api';
import type { CmsForm as CmsFormDoc, CmsMembership, CmsTechTour } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import { APPLICATION_ROUND, applicationStatus } from '../../lib/applicationPhase';
import { techTourListed, techTourRegistrationOpen } from '../../lib/techTour';
import CmsForm from '../forms/CmsForm';
import JoinSteps from './JoinSteps';
import WaitlistSignup from './WaitlistSignup';
import './landing.css';
import './join.css';

/**
 * The application is the form-builder form titled "application". Matched
 * exactly: falling back to "the first form" would put the TechTour
 * registration on this page if the title were ever changed.
 */
const FORM_TITLE = 'application';

export interface JoinApplyProps {
    /** For the contact address under the steps. */
    membership?: CmsMembership | null;
    forms?: CmsFormDoc[] | null;
    /** Decides whether the "also register for the TechTour" box is offered. */
    techTour?: CmsTechTour | null;
    /** Request time from the server component; see BecomeAMember for why. */
    serverNow?: number;
}

/**
 * /join/apply – the application itself, behind every button on /join.
 *
 * Beside the form, the three steps say what happens after sending it. While
 * the round is open the card holds the form, which is defined in the CMS and
 * rendered by the shared CmsForm: every question, the CV upload, the
 * "also register for the TechTour" box. Before the window opens – and after
 * it closes – the card holds the "notify me" signup instead, so a link on a
 * poster or in an ad never leads to a dead end.
 */
const JoinApply: React.FC<JoinApplyProps> = (props) => {
    const { t, locale } = useLanguage();
    const siteConfig = useSiteConfig();
    const { data: membership } = useCmsGlobal<CmsMembership>('membership', props.membership);
    const { data: techTour } = useCmsGlobal<CmsTechTour>('tech-tour', props.techTour);
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
    const status = applicationStatus(now);
    const round = APPLICATION_ROUND[locale];

    // The "also register for the TechTour" box (and its "What is the TechTour?"
    // link) is offered only while that page is listed (TechTour Page →
    // Visibility is not "hidden") and its registration is open.
    const hiddenSubforms =
        techTourListed(techTour) && techTourRegistrationOpen(techTour, now)
            ? undefined
            : ['techtour'];

    // Two parts rather than one run of questions: who you are, then the
    // application. A name the CMS doesn't use is simply skipped.
    const sections = useMemo(
        () => [
            { at: 'firstName', title: t.join.apply.sectionAbout },
            { at: 'why', title: t.join.apply.sectionApplication },
        ],
        [t]
    );

    const email = membership?.contactEmail || siteConfig.email;
    const [contactBefore, contactAfter = ''] = t.join.apply.contact.split('{email}');

    // Head, form, steps – the order a phone shows them in. On a wide screen
    // the grid lifts the form into the right-hand column beside the other two.
    return (
        <div className="lp jn jn-apply">
            <div className="lp-page">
                <div className="lp-inner jn-apply__grid">
                    <motion.div
                        className="jn-apply__head"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <p className="lp-kicker">
                            <Link className="jn-back" href="/join">
                                ← {t.join.apply.back}
                            </Link>
                        </p>
                        <h1 className="lp-page__title">
                            {t.join.apply.title.replace('{round}', round)}
                        </h1>
                        <span
                            className={`lp-round-status jn-status--${status}${
                                status === 'closed' ? ' lp-round-status--closed' : ''
                            }`}
                        >
                            <span className="lp-round-status__dot" aria-hidden="true" />
                            {t.join.status[status]}
                        </span>
                        <p className="jn-apply__lead">{t.join.apply.lead[status]}</p>
                    </motion.div>

                    <motion.div
                        className="jn-apply__main"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <div className="jn-card" id="apply-form">
                            {status === 'open' ? (
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
                                            hiddenSubforms={hiddenSubforms}
                                            sections={sections}
                                        />
                                    )}
                                </>
                            ) : status === 'upcoming' ? (
                                <WaitlistSignup
                                    title={t.join.upcomingTitle}
                                    lead={t.join.upcomingLead}
                                />
                            ) : (
                                <WaitlistSignup
                                    title={t.join.waitlistTitle}
                                    lead={t.join.waitlistLead}
                                />
                            )}
                        </div>
                    </motion.div>

                    <motion.div
                        className="jn-apply__steps"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                    >
                        <p className="jn-apply__label">{t.join.howItWorks}</p>
                        <JoinSteps now={now} variant="compact" />
                        {email && (
                            <p className="jn-apply__contact">
                                {contactBefore}
                                <a href={`mailto:${email}`}>{email}</a>
                                {contactAfter}
                            </p>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default JoinApply;
