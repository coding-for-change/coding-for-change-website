'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { mediaUrl, useCmsGlobal, useCmsCollection } from '../../api';
import type { CmsForm as CmsFormDoc, CmsTechTour, CmsTechTourEvent } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';
import CmsForm from '../forms/CmsForm';
import useDarkNav from '../../hooks/useDarkNav';
import { applicationsOpen } from '../../lib/applicationPhase';
import { formatDateRange, techTourRegistrationOpen } from '../../lib/techTour';
import './landing.css';
import './techtourApply.css';

/** The registration form is the form-builder form titled "techtour". */
const FORM_TITLE = 'techtour';

/**
 * Where a half-finished registration is parked when the visitor presses "save
 * and finish later". Declared as § 25(2) TDDDG storage in `lib/klaroConfig.ts`
 * ("site basics") and allow-listed in `scripts/consent-scan.mjs`.
 */
const DRAFT_KEY = 'cfc-techtour-draft';

/**
 * First sentence only. A description written for /techtour, where the evening
 * has a panel to itself, has to become one line in a row here — and the
 * opening sentence is the part that identifies the visit.
 */
const firstSentence = (text: string): string => {
    const trimmed = text.trim();
    const end = trimmed.search(/[.!?](\s|$)/);
    return end === -1 ? trimmed : trimmed.slice(0, end + 1);
};

/**
 * Which evening an option of the form's "which evenings" question refers to.
 *
 * The options are typed by hand in the form builder while the evenings live in
 * the TechTour global, so nothing joins them by id. The day of the month is the
 * strongest signal — every option label carries the date — the company name is
 * the next, and the position in the list is the fallback. A signal that matches
 * two evenings (both TBA slots share a company name) is dropped rather than
 * guessed at, so a row never shows the wrong company's logo.
 */
const matchEvening = (
    option: { label: string; value: string },
    index: number,
    events: CmsTechTourEvent[]
): CmsTechTourEvent | null => {
    const hay = `${option.value} ${option.label}`.toLowerCase();
    const only = (list: CmsTechTourEvent[]) => (list.length === 1 ? list[0] : null);

    const byDay = only(
        events.filter((ev) => {
            const day = new Date(ev.date).getDate();
            return (
                Number.isFinite(day) &&
                new RegExp(`(^|\\D)${day}(\\D|$)`).test(hay)
            );
        })
    );
    if (byDay) return byDay;

    const byCompany = only(
        events.filter((ev) =>
            (ev.company ?? '')
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .filter((word) => word.length > 2)
                .some((word) => hay.includes(word))
        )
    );
    if (byCompany) return byCompany;

    return events[index] ?? null;
};

export interface TechTourApplyProps {
    techTour?: CmsTechTour | null;
    forms?: CmsFormDoc[] | null;
    /** Request time from the server component; see BecomeAMember for why. */
    serverNow?: number;
}

/**
 * Where "Apply now" on /techtour leads: the registration itself, on the same
 * dark stage, with nothing on the page that is not part of sending it.
 *
 * What the week contains is told on /techtour (the Explore section), so this
 * page does not repeat it — each evening appears only as a row inside the
 * form's "which evenings" question, with the company's logo, its one-liner and
 * the date next to the checkbox that picks it. Above the form, three steps say
 * how this goes; below it, the note that none of it is binding. Everything
 * between — the questions, the attendance commitment, the optional "also apply
 * for membership" box — is defined in the CMS and rendered by the shared
 * CmsForm, which this page asks for two things it does not do elsewhere: the
 * evenings first, and a heading over the personal half.
 */
const TechTourApply: React.FC<TechTourApplyProps> = (props) => {
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
    const open = techTourRegistrationOpen(tt, now);
    // Outside the membership round's window, the "also apply" box goes too.
    const hiddenSubforms = applicationsOpen(now) ? undefined : ['application'];

    const events = useMemo(
        () =>
            [...(tt?.events ?? [])].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            ),
        [tt]
    );

    const dateLocale = locale === 'de' ? 'de-DE' : 'en-GB';
    const fmtDeadline = (d: Date) =>
        d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });

    /**
     * How this goes, in three steps — the whole of the old lead paragraph's
     * job, in a quarter of the words.
     *
     * Step 2 has no date because the CMS has none: there is no "feedback by"
     * field, and a date we invent here is a promise nobody in the team agreed
     * to. It says how the answer arrives instead. The other two read their
     * dates off the CMS, and a step whose date is missing simply loses its
     * second line rather than showing an empty one.
     */
    const steps = (() => {
        const deadlineText =
            deadline && !Number.isNaN(deadline.getTime())
                ? t.techtour.stepApplyText.replace('{date}', fmtDeadline(deadline))
                : null;
        const first = events[0] ? new Date(events[0].date) : null;
        const last = events[events.length - 1] ? new Date(events[events.length - 1].date) : null;
        const rangeText =
            first && last && !Number.isNaN(first.getTime()) && !Number.isNaN(last.getTime())
                ? t.techtour.stepJoinText.replace(
                      '{range}',
                      formatDateRange(first, last, dateLocale)
                  )
                : null;
        return [
            { title: t.techtour.stepApplyTitle, text: deadlineText },
            { title: t.techtour.stepConfirmTitle, text: t.techtour.stepConfirmText },
            { title: t.techtour.stepJoinTitle, text: rangeText },
        ];
    })();

    /** One evening, as the label of its checkbox. */
    const renderEvening = useCallback(
        (option: { label: string; value: string }, index: number) => {
            const ev = matchEvening(option, index, events);
            // Nothing to enrich it with: CmsForm falls back to the plain label.
            if (!ev) return null;
            const tba = ev.status === 'tba';
            const company = tba ? t.techtour.tbaCompany : ev.company;
            const logo = tba ? null : mediaUrl(ev.logo);
            const line = tba
                ? null
                : ev.title || (ev.description ? firstSentence(ev.description) : null);
            const date = new Date(ev.date);
            return (
                <span className="tta-ev">
                    <span
                        className={`tta-ev__logo${tba ? ' tta-ev__logo--tba' : ''}`}
                        aria-hidden="true"
                    >
                        {logo ? (
                            <img src={logo} alt="" loading="lazy" />
                        ) : (
                            <span className="tta-ev__mark">
                                {tba ? '?' : company.trim().charAt(0)}
                            </span>
                        )}
                    </span>
                    <span className="tta-ev__body">
                        <span className="tta-ev__company">{company}</span>
                        {line && <span className="tta-ev__line">{line}</span>}
                    </span>
                    <span className="tta-ev__when">
                        <span className="tta-ev__day">
                            {date.toLocaleDateString(dateLocale, { weekday: 'short' })}
                        </span>
                        <span className="tta-ev__date">
                            {date.toLocaleDateString(dateLocale, {
                                day: 'numeric',
                                month: 'short',
                            })}
                        </span>
                        {ev.time && <span className="tta-ev__time">{ev.time}</span>}
                        {ev.status === 'tentative' && (
                            <span className="tta-ev__badge">{t.techtour.tentative}</span>
                        )}
                    </span>
                </span>
            );
        },
        [events, dateLocale, t]
    );

    /**
     * The question whose options are the evenings. Named `events` in the CMS
     * today; any single checkbox group on this form can only be that question,
     * so a rename in the admin does not silently drop the rows.
     */
    const eveningsField = useMemo(() => {
        const groups = (form?.fields ?? []).filter((f) => f.blockType === 'checkboxGroup');
        return groups.find((f) => f.name === 'events')?.name ?? groups[0]?.name ?? null;
    }, [form]);

    /**
     * Which evenings comes first: it is the decision this page is about, and
     * the rest of the form is only the paperwork that follows it. The CMS
     * order still governs every other page that renders this form.
     */
    const fieldOrder = useMemo(
        () => (eveningsField ? [eveningsField] : undefined),
        [eveningsField]
    );

    /**
     * Two parts, not one run of questions: which evenings (the fieldset's own
     * legend is that heading — a group of checkboxes deserves a real legend),
     * then everything about the person. The heading opens at the first
     * question the CMS asks after the evenings, whatever it is called.
     */
    const sections = useMemo(() => {
        const after = (form?.fields ?? []).find(
            (f) =>
                f.blockType !== 'message' &&
                f.blockType !== 'checkboxGroup' &&
                f.blockType !== 'subform'
        );
        return after && 'name' in after
            ? [{ at: after.name, title: t.techtour.sectionDetailsTitle }]
            : undefined;
    }, [form, t]);

    const checkboxGroups = useMemo(() => {
        if (!eveningsField || events.length === 0) return undefined;
        return {
            [eveningsField]: {
                renderOption: renderEvening,
                // One line, with the rows it is about. The CMS `commitment`
                // field used to supply this and is no longer rendered: it is a
                // paragraph, and what belongs under a list of tick boxes is a
                // single sentence.
                note: <span className="tta-ask">{t.techtour.attendAsk}</span>,
            },
        };
    }, [eveningsField, events.length, renderEvening, t]);

    useDarkNav();

    return (
        <div className="lp lp--techtour tta">
            <div className="lp-page lp-tt-stage">
                <div className="lp-inner tta-col">
                    <motion.div
                        className="lp-page__head lp-tt-head tta-head"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <p className="lp-kicker">
                            <Link className="lp-tt-back" href="/techtour">
                                ← {t.techtour.backToTour}
                            </Link>
                        </p>
                        <h1 className="lp-page__title">
                            {tt?.formHeading || t.techtour.formHeading}
                        </h1>
                        <div className="lp-page__actions">
                            {/* The deadline itself is step 1 below, so the pill
                                carries only the state of the round. */}
                            <span
                                className={`lp-round-status${
                                    open ? ' lp-round-status--open' : ' lp-round-status--closed'
                                }`}
                            >
                                <span className="lp-round-status__dot" aria-hidden="true" />
                                {open ? t.techtour.statusOpen : t.techtour.statusClosed}
                            </span>
                        </div>
                        <ol className="tta-steps">
                            {steps.map((step, i) => (
                                <li className="tta-step" key={step.title}>
                                    <span className="tta-step__n" aria-hidden="true">
                                        {i + 1}
                                    </span>
                                    <span className="tta-step__body">
                                        <span className="tta-step__title">{step.title}</span>
                                        {step.text && (
                                            <span className="tta-step__text">{step.text}</span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </motion.div>

                    <motion.div
                        className="tta-form"
                        id="techtour-form"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
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
                                        hiddenSubforms={hiddenSubforms}
                                        checkboxGroups={checkboxGroups}
                                        fieldOrder={fieldOrder}
                                        sections={sections}
                                        draft={{
                                            key: DRAFT_KEY,
                                            labels: {
                                                save: t.techtour.draftSave,
                                                saved: t.techtour.draftSaved,
                                                restored: t.techtour.draftRestored,
                                                clear: t.techtour.draftClear,
                                                cleared: t.techtour.draftCleared,
                                                note: t.techtour.draftNote,
                                            },
                                        }}
                                    />
                                )}
                            </>
                        ) : (
                            // The shared .lp-tt-close__* rules are gone from
                            // landing.css, so the closed state is dressed here.
                            <>
                                <h2 className="tta-closed__head">{t.techtour.statusClosed}</h2>
                                <p className="tta-closed__text">
                                    {tt?.closedMessage || t.techtour.closedFallback}
                                </p>
                            </>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default TechTourApply;
