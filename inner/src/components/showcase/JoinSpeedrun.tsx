'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCmsCollection, useCmsGlobal, useSiteConfig } from '../../api';
import type { CmsForm as CmsFormDoc, CmsFormField, CmsMembership } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import { APPLICATION_ROUND, speedrunStatus } from '../../lib/applicationPhase';
import CmsForm from '../forms/CmsForm';
import WaitlistSignup from './WaitlistSignup';
import './landing.css';
import './join.css';

/** The application form in the CMS, as on /join/apply; this page sends to it too. */
const FORM_TITLE = 'application';

/**
 * Questions taken from the application form as they are, so the options and
 * wording (and the privacy box the applicant agrees to) stay the ones the
 * admin set for /join/apply.
 */
const SHARED = ['firstName', 'lastName', 'email', 'university', 'track', 'expectations', 'privacy'];

/** Every question on this page, in order: the shared ones plus the one defined below. */
const ORDER = [
    'firstName',
    'lastName',
    'email',
    'university',
    'track',
    'hoursPerWeek',
    'expectations',
    'privacy',
];

/** The team choice, and the hours a week as one row of buttons. */
const BUTTON_SELECTS = ['track', 'hoursPerWeek'];

/** The same guide to length as on /join/apply. */
const TEXT_LIMITS = { expectations: 600 };

export interface JoinSpeedrunProps {
    /** For the contact address under the form. */
    membership?: CmsMembership | null;
    forms?: CmsFormDoc[] | null;
    /** Request time from the server component; see BecomeAMember for why. */
    serverNow?: number;
}

/**
 * /join/speedrun – the short application, for anyone who would not get round
 * to the full one before the deadline: who you are, where you study, which
 * team, how much time, one question, no CV.
 *
 * Laid out like /join/apply (head, then the form across the column) minus the
 * steps strip, whose first step asks for a CV. It is the same form, too: the
 * questions it shares with the application come from the CMS "application"
 * form, the one it adds (hours a week) is defined here, and it is sent to
 * that form marked `source: 'speedrun'`, so these applicants are reviewed in
 * the same list with a badge saying why their CV is missing. Nothing is kept
 * in the browser – it is short enough not to need a draft. It closes a day
 * after the full form (SPEEDRUN_DEADLINE); outside its dates the card holds
 * the "notify me" signup, as on /join/apply.
 */
const JoinSpeedrun: React.FC<JoinSpeedrunProps> = (props) => {
    const { t, locale } = useLanguage();
    const s = t.join.speedrun;
    const siteConfig = useSiteConfig();
    const { data: membership } = useCmsGlobal<CmsMembership>('membership', props.membership);
    const {
        data: forms,
        loading: formsLoading,
        error: formsError,
    } = useCmsCollection<CmsFormDoc>('forms', undefined, props.forms);

    const [now, setNow] = useState(() => props.serverNow ?? Date.now());
    useEffect(() => {
        setNow(Date.now());
    }, []);
    // Its own deadline: a day after the full form's (lib/applicationPhase.ts).
    const status = speedrunStatus(now);
    const round = APPLICATION_ROUND[locale];

    // The application form cut down to this page's questions. Null when it
    // is missing or no longer asks one of the shared questions: better the
    // "email us" note than a form without the privacy box.
    const form = useMemo((): CmsFormDoc | null => {
        const application = forms?.find((f) => f.title.trim().toLowerCase() === FORM_TITLE);
        if (!application) return null;
        const byName = new Map<string, CmsFormField>();
        (application.fields ?? []).forEach((f) => {
            if (f.blockType !== 'message') byName.set(f.name, f);
        });
        if (SHARED.some((name) => !byName.has(name))) return null;

        // The answer is stored in English whatever the page language, so the
        // review reads the same for everyone.
        const q = s.questions;
        const own: Record<string, CmsFormField> = {
            hoursPerWeek: {
                blockType: 'select',
                name: 'hoursPerWeek',
                label: q.hours,
                required: true,
                options: [
                    { value: 'less than 3h', label: q.hoursOptions.under3 },
                    { value: '3–5h', label: q.hoursOptions.from3to5 },
                    { value: '5–7h', label: q.hoursOptions.from5to7 },
                    { value: '7h+', label: q.hoursOptions.over7 },
                ],
            },
        };
        return {
            ...application,
            fields: ORDER.map((name) => own[name] ?? byName.get(name)).filter(
                (f): f is CmsFormField => Boolean(f)
            ),
        };
    }, [forms, s]);

    const email = membership?.contactEmail || siteConfig.email;
    const [contactBefore, contactAfter = ''] = t.join.apply.contact.split('{email}');

    return (
        <div className="lp jn jn-apply jn-speedrun">
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
                        <h1 className="lp-page__title">{s.title}</h1>
                        {status === 'open' ? (
                            <span className="lp-round-status jn-status--open">
                                <span className="lp-round-status__dot" aria-hidden="true" />
                                {s.meta
                                    .replace('{round}', round)
                                    .split(' · ')
                                    .map((part, i) => (
                                        <React.Fragment key={part}>
                                            {/* A line may break after a dot, never before one. */}
                                            {i > 0 && (
                                                <>
                                                    {' '}
                                                    <span
                                                        className="lp-round-status__sep"
                                                        aria-hidden="true"
                                                    >
                                                        ·
                                                    </span>{' '}
                                                </>
                                            )}
                                            <span className="jn-speedrun__part">{part}</span>
                                        </React.Fragment>
                                    ))}
                            </span>
                        ) : (
                            <span
                                className={`lp-round-status jn-status--${status}${
                                    status === 'closed' ? ' lp-round-status--closed' : ''
                                }`}
                            >
                                <span className="lp-round-status__dot" aria-hidden="true" />
                                {t.join.status[status]}
                            </span>
                        )}
                        <p className="jn-apply__lead">
                            {status === 'open' ? s.lead : t.join.apply.lead[status]}
                        </p>
                    </motion.div>

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
                                        source="speedrun"
                                        buttonSelects={BUTTON_SELECTS}
                                        textLimits={TEXT_LIMITS}
                                        confirmation={(answers) => (
                                            <p className="jn-speedrun__done">
                                                {s.success.replace(
                                                    '{firstName}',
                                                    (answers.firstName ?? '').trim()
                                                )}
                                            </p>
                                        )}
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

export default JoinSpeedrun;
