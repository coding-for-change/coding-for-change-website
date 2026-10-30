'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { TechTourManageEvening, TechTourManageView } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import useDarkNav from '../../hooks/useDarkNav';
import { known } from '../../lib/techTour';
import './landing.css';
import './techtourApply.css';
import './techtourManage.css';

const CONTACT_EMAIL = 'info@codingforchange.com';

/** The token test mails and the mail preview carry (inner/cms/src/lib/manage/link.ts). */
const SAMPLE_TOKEN = 'sample';

export interface TechTourManageProps {
    token: string;
    /** Read on the server for the token; null when it opens nothing. */
    initialView: TechTourManageView | null;
    initialLocale: 'en' | 'de';
}

/**
 * /techtour/manage – the link in our mail to a TechTour registrant: the
 * evenings they registered for, as ticked boxes, and the one thing they can do
 * here – untick some and save. Never tick: a new evening means a new
 * registration. Until the deadline (`until`, from the CMS); after it, the
 * same list without the button.
 *
 * Saving asks once more, naming the evenings, because the page cannot undo it:
 * a given-up evening stays given up and shows when it was given up.
 *
 * Same dark stage and evening rows as /techtour/apply.
 */
const TechTourManage: React.FC<TechTourManageProps> = ({ token, initialView, initialLocale }) => {
    const { t, locale } = useLanguage();
    const m = t.techtourManage;
    const [view, setView] = useState(initialView);
    const [unticked, setUnticked] = useState<Set<string>>(() => new Set());
    const [confirming, setConfirming] = useState(false);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<null | 'saved' | 'error'>(null);
    const readIn = useRef<string>(initialLocale);

    useDarkNav();

    // The evenings' labels come from the CMS in one language: switching the
    // site's language reads them again.
    useEffect(() => {
        if (!view || locale === readIn.current) return;
        readIn.current = locale;
        fetch(`/api/techtour/manage?token=${encodeURIComponent(token)}&locale=${locale}`, {
            cache: 'no-store',
        })
            .then((res) => (res.ok ? (res.json() as Promise<TechTourManageView>) : null))
            .then((next) => next && setView(next))
            .catch(() => undefined);
    }, [locale, token, view]);

    const dateLocale = locale === 'de' ? 'de-DE' : 'en-GB';
    const withEmail = (text: string) => {
        const [before, after] = text.split('{email}');
        return after === undefined ? (
            text
        ) : (
            <>
                {before}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                {after}
            </>
        );
    };

    // "Sun 1 Nov": the day of the last minute changes were possible, in Munich.
    const deadline = view
        ? new Date(Date.parse(view.until) - 60_000).toLocaleDateString(dateLocale, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              timeZone: 'Europe/Berlin',
          })
        : '';
    const open = Boolean(view?.open);
    const active = view?.evenings.filter((ev) => !ev.withdrawnAt) ?? [];
    const leaving = active.filter((ev) => unticked.has(ev.option));

    const toggle = (option: string, checked: boolean) => {
        setStatus(null);
        setConfirming(false);
        setUnticked((prev) => {
            const next = new Set(prev);
            if (checked) next.delete(option);
            else next.add(option);
            return next;
        });
    };

    const save = async () => {
        setSaving(true);
        setStatus(null);
        try {
            const res = await fetch('/api/techtour/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, withdraw: leaving.map((ev) => ev.option), locale }),
            });
            if (res.status === 403) {
                // The deadline passed while the page was open.
                setView((v) => v && { ...v, open: false });
                setUnticked(new Set());
                return;
            }
            if (!res.ok) throw new Error(String(res.status));
            setView((await res.json()) as TechTourManageView);
            setUnticked(new Set());
            setStatus('saved');
        } catch {
            setStatus('error');
        } finally {
            setSaving(false);
            setConfirming(false);
        }
    };

    const renderEvening = (ev: TechTourManageEvening) => {
        const date = ev.date ? new Date(ev.date) : null;
        const time = known(ev.time);
        const gone = ev.withdrawnAt ? new Date(ev.withdrawnAt) : null;
        return (
            <label
                key={ev.option}
                className={`lp-checkbox lp-checkbox--rich${gone ? ' ttm-row--gone' : ''}`}
            >
                <input
                    type="checkbox"
                    value={ev.option}
                    checked={!gone && !unticked.has(ev.option)}
                    disabled={Boolean(gone) || !open || saving}
                    onChange={(e) => toggle(ev.option, e.target.checked)}
                />
                <span className="tta-ev">
                    <span className="tta-ev__body">
                        <span className="tta-ev__company">{ev.company || ev.label}</span>
                        {ev.title && <span className="tta-ev__line">{ev.title}</span>}
                        {gone && (
                            <span className="tta-ev__badge">
                                {m.withdrawnOn.replace(
                                    '{date}',
                                    gone.toLocaleDateString(dateLocale, {
                                        day: 'numeric',
                                        month: 'short',
                                        timeZone: 'Europe/Berlin',
                                    })
                                )}
                            </span>
                        )}
                    </span>
                    {date && !Number.isNaN(date.getTime()) && (
                        <span className="tta-ev__when">
                            <span className="tta-ev__day">
                                {date.toLocaleDateString(dateLocale, {
                                    weekday: 'short',
                                    timeZone: 'Europe/Berlin',
                                })}
                            </span>
                            <span className="tta-ev__date">
                                {date.toLocaleDateString(dateLocale, {
                                    day: 'numeric',
                                    month: 'short',
                                    timeZone: 'Europe/Berlin',
                                })}
                            </span>
                            {time && <span className="tta-ev__time">{time}</span>}
                        </span>
                    )}
                </span>
            </label>
        );
    };

    const list = new Intl.ListFormat(dateLocale, { type: 'conjunction' }).format(
        leaving.map((ev) => ev.label)
    );

    return (
        <div className="lp lp--techtour tta ttm">
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
                        <h1 className="lp-page__title">{m.title}</h1>
                        {view && <p className="ttm-lead">{m.intro}</p>}
                    </motion.div>

                    <motion.div
                        className="tta-form"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        {!view ? (
                            <p className="ttm-note">
                                {token === SAMPLE_TOKEN ? m.sample : withEmail(m.invalid)}
                            </p>
                        ) : (
                            <div className="lp-cmsform">
                                {view.name && (
                                    <p className="ttm-name">{m.named.replace('{name}', view.name)}</p>
                                )}
                                <fieldset className="lp-field lp-checkgroup lp-checkgroup--rich">
                                    <legend className="lp-label">{m.legend}</legend>
                                    <div className="lp-checkgroup__options">
                                        {view.evenings.map(renderEvening)}
                                    </div>
                                </fieldset>

                                {open ? (
                                    <>
                                        <p className="ttm-note">
                                            {m.until.replace('{date}', deadline)} {m.onlyRemove}
                                        </p>
                                        {confirming && leaving.length > 0 ? (
                                            <div className="ttm-confirm" role="alertdialog" aria-live="polite">
                                                <p className="ttm-confirm__text">
                                                    {m.confirm.replace('{list}', list)}
                                                </p>
                                                <div className="ttm-confirm__actions">
                                                    <button
                                                        className="lp-submit"
                                                        type="button"
                                                        onClick={() => void save()}
                                                        disabled={saving}
                                                    >
                                                        {saving ? m.saving : m.confirmYes}
                                                    </button>
                                                    <button
                                                        className="ttm-cancel"
                                                        type="button"
                                                        onClick={() => setConfirming(false)}
                                                        disabled={saving}
                                                    >
                                                        {m.cancel}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                className="lp-submit"
                                                type="button"
                                                onClick={() => setConfirming(true)}
                                                disabled={leaving.length === 0 || saving}
                                            >
                                                {m.save}
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <p className="ttm-note">
                                        {withEmail(m.closed.replace('{date}', deadline))}
                                    </p>
                                )}

                                {status === 'saved' && (
                                    <p className="ttm-status" role="status">
                                        {active.length === 0 ? m.allGone : m.saved}
                                    </p>
                                )}
                                {status === 'error' && (
                                    <p className="ttm-status ttm-status--error" role="alert">
                                        {withEmail(m.error)}
                                    </p>
                                )}
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default TechTourManage;
