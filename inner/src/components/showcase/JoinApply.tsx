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

/**
 * Where a half-finished application is kept while the visitor types (auto-save,
 * see CmsForm `draft.auto`). Declared as § 25(2) TDDDG storage in `lib/klaroConfig.ts`
 * ("site basics") and allow-listed in `scripts/consent-scan.mjs`.
 */
const DRAFT_KEY = 'cfc-application-draft';

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
 * One column, like /techtour/apply: the head, the three steps as a strip
 * saying what happens after sending it, then the form across the full width.
 * While the round is open that is the form, which is defined in the CMS and
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
            { at: 'university', title: t.join.apply.sectionApplication },
        ],
        [t]
    );
    // "Where would you like to work?" – two teams, each with a line saying
    // what it does, reads better as two buttons than as a dropdown.
    const buttonSelects = useMemo(() => ['track'], []);
    // A guide to how much we expect per answer: a few sentences each, a bit
    // more for the project or activity. Questions not named here have no cap.
    const textLimits = useMemo(
        () => ({ proudOf: 1000, expectations: 600, vibeCoding: 600, ngo: 600 }),
        []
    );

    const email = membership?.contactEmail || siteConfig.email;
    const [contactBefore, contactAfter = ''] = t.join.apply.contact.split('{email}');

    return (
        <div className="lp jn jn-apply">
            <div className="lp-page">
                <div className="lp-inner jn-apply__col">
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

                    <div className="jn-apply__steps">
                        <JoinSteps now={now} variant="strip" />
                    </div>

                    <motion.div
                        className="jn-apply__main"
                        id="apply-form"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
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
                                        buttonSelects={buttonSelects}
                                        textLimits={textLimits}
                                        draft={{
                                            key: DRAFT_KEY,
                                            auto: true,
                                            // Saved as they type, so no button;
                                            // the rest of the TechTour page's
                                            // wording says nothing TechTour-specific.
                                            labels: {
                                                save: t.techtour.draftSave,
                                                saved: t.techtour.draftSaved,
                                                restored: t.techtour.draftRestored,
                                                clear: t.techtour.draftClear,
                                                cleared: t.techtour.draftCleared,
                                                note: t.join.apply.draftNote,
                                            },
                                        }}
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
