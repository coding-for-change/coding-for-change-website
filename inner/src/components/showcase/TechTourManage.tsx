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

type Status = { option: string; kind: 'withdrawn' | 'confirmed' | 'error' };

const todoKey = (option: string, id: string) => `${option} ${id}`;

/**
 * /techtour/manage – the link in our mails to a TechTour registrant: one card
 * per evening that says where it stands – in, waitlist, not decided yet (an
 * evening the host declined is not listed; that news comes by mail) – and
 * what to do about it:
 *
 * - Admitted with to-dos from the host (TechTour → Company visits → To-dos in
 *   the CMS, e.g. registering in the host's portal, a confidentiality
 *   agreement): tick them and confirm. A tick stays, with its date.
 * - Admitted without to-dos: nothing – the card says so.
 * - Any evening until it is over: withdraw, after a second "are you sure",
 *   because the page cannot undo it. Never add one: a new evening means a new
 *   registration. Withdrawing an evening one was admitted to lets the next on
 *   its waitlist move up.
 *
 * Same dark stage and evening rows as /techtour/apply.
 */
const TechTourManage: React.FC<TechTourManageProps> = ({ token, initialView, initialLocale }) => {
    const { t, locale } = useLanguage();
    const m = t.techtourManage;
    const [view, setView] = useState(initialView);
    const [ticked, setTicked] = useState<Set<string>>(() => new Set());
    const [asking, setAsking] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [status, setStatus] = useState<Status | null>(null);
    const readIn = useRef<string>(initialLocale);

    useDarkNav();

    const reload = async (lang: string) => {
        const res = await fetch(`/api/techtour/manage?token=${encodeURIComponent(token)}&locale=${lang}`, {
            cache: 'no-store',
        });
        if (res.ok) setView((await res.json()) as TechTourManageView);
    };

    // The evenings' labels and to-dos come from the CMS in one language:
    // switching the site's language reads them again.
    useEffect(() => {
        if (!view || locale === readIn.current) return;
        readIn.current = locale;
        reload(locale).catch(() => undefined);
    }, [locale, token, view]);

    const dateLocale = locale === 'de' ? 'de-DE' : 'en-GB';
    const shortDate = (iso: string) =>
        new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', timeZone: 'Europe/Berlin' });
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

    const evenings = view?.evenings ?? [];
    const active = evenings.filter((ev) => !ev.withdrawnAt);

    /** One POST; true when it went through. 403: the page was out of date – show where things stand now. */
    const post = async (option: string, body: Record<string, unknown>): Promise<boolean> => {
        setBusy(option);
        setStatus(null);
        try {
            const res = await fetch('/api/techtour/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, locale, ...body }),
            });
            if (res.status === 403) {
                await reload(locale);
                return false;
            }
            if (!res.ok) throw new Error(String(res.status));
            setView((await res.json()) as TechTourManageView);
            return true;
        } catch {
            setStatus({ option, kind: 'error' });
            return false;
        } finally {
            setBusy(null);
            setAsking(null);
        }
    };

    const withdraw = async (ev: TechTourManageEvening) => {
        if (await post(ev.option, { withdraw: [ev.option] })) setStatus({ option: ev.option, kind: 'withdrawn' });
    };

    const confirmTodos = async (ev: TechTourManageEvening) => {
        const ids = ev.todos.filter((td) => !td.doneAt && ticked.has(todoKey(ev.option, td.id))).map((td) => td.id);
        if (ids.length === 0) return;
        if (await post(ev.option, { confirm: { option: ev.option, todos: ids } })) {
            setStatus({ option: ev.option, kind: 'confirmed' });
            setTicked((prev) => new Set([...prev].filter((k) => !k.startsWith(`${ev.option} `))));
        }
    };

    const tick = (key: string, checked: boolean) => {
        setStatus(null);
        setTicked((prev) => {
            const next = new Set(prev);
            if (checked) next.add(key);
            else next.delete(key);
            return next;
        });
    };

    const renderTodos = (ev: TechTourManageEvening, name: string) => {
        if (ev.todos.length === 0) return null;
        const allDone = ev.todos.every((td) => td.doneAt);
        const anyTicked = ev.todos.some((td) => !td.doneAt && ticked.has(todoKey(ev.option, td.id)));
        return (
            <div className={`ttm-todos${allDone ? ' ttm-todos--done' : ''}`}>
                <p className="ttm-todos__head">{allDone ? m.todosDone : m.todosHead.replace('{name}', name)}</p>
                <ul className="ttm-todos__list">
                    {ev.todos.map((td) => {
                        const key = todoKey(ev.option, td.id);
                        return (
                            <li key={td.id} className={`ttm-todo${td.doneAt ? ' ttm-todo--done' : ''}`}>
                                <label className="ttm-todo__check">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(td.doneAt) || ticked.has(key)}
                                        disabled={Boolean(td.doneAt) || busy !== null}
                                        onChange={(e) => tick(key, e.target.checked)}
                                    />
                                    <span className="ttm-todo__text">{td.text}</span>
                                </label>
                                {(td.linkUrl || td.doneAt) && (
                                    <span className="ttm-todo__meta">
                                        {td.linkUrl && (
                                            <a
                                                className="ttm-todo__link"
                                                href={td.linkUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {td.linkLabel || m.openLink} ↗
                                            </a>
                                        )}
                                        {td.doneAt && (
                                            <span className="ttm-todo__done">
                                                ✓ {m.todoDoneOn.replace('{date}', shortDate(td.doneAt))}
                                            </span>
                                        )}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
                {!allDone && (
                    <button
                        className="lp-submit ttm-todos__save"
                        type="button"
                        onClick={() => void confirmTodos(ev)}
                        disabled={!anyTicked || busy !== null}
                    >
                        {busy === ev.option ? m.saving : m.confirmTodos}
                    </button>
                )}
            </div>
        );
    };

    const renderState = (ev: TechTourManageEvening) => {
        if (ev.withdrawnAt) {
            return <span className="ttm-pill ttm-pill--gone">{m.withdrawnOn.replace('{date}', shortDate(ev.withdrawnAt))}</span>;
        }
        if (!ev.open) return <span className="ttm-pill ttm-pill--gone">{m.over}</span>;
        if (ev.decision === 'admitted') {
            return (
                <>
                    <span className="ttm-pill ttm-pill--in">✓ {m.stateIn}</span>
                    {ev.todos.length === 0 && <span className="ttm-ev__hint">{m.stateInNothing}</span>}
                </>
            );
        }
        if (ev.decision === 'waitlisted') {
            return (
                <>
                    <span className="ttm-pill ttm-pill--waitlist">{m.stateWaitlist}</span>
                    <span className="ttm-ev__hint">{m.stateWaitlistHint}</span>
                </>
            );
        }
        return (
            <>
                <span className="ttm-pill ttm-pill--open">{m.stateOpen}</span>
                <span className="ttm-ev__hint">{m.stateOpenHint}</span>
            </>
        );
    };

    const renderEvening = (ev: TechTourManageEvening) => {
        const date = ev.date ? new Date(ev.date) : null;
        const time = known(ev.time);
        const name = ev.company || ev.label;
        const gone = Boolean(ev.withdrawnAt) || !ev.open;
        const kind = gone ? 'gone' : ev.decision === 'admitted' ? 'in' : 'other';
        const mine = status?.option === ev.option ? status : null;
        return (
            <section key={ev.option} className={`ttm-ev ttm-ev--${kind}`} aria-label={name}>
                <div className="tta-ev">
                    <span className="tta-ev__body">
                        <span className="tta-ev__company">{name}</span>
                        {ev.title && <span className="tta-ev__line">{ev.title}</span>}
                    </span>
                    {date && !Number.isNaN(date.getTime()) && (
                        <span className="tta-ev__when">
                            <span className="tta-ev__day">
                                {date.toLocaleDateString(dateLocale, { weekday: 'short', timeZone: 'Europe/Berlin' })}
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
                </div>

                <div className="ttm-ev__state">{renderState(ev)}</div>

                {renderTodos(ev, name)}

                {!gone &&
                    (asking === ev.option ? (
                        <div className="ttm-confirm" role="alertdialog" aria-live="polite">
                            <p className="ttm-confirm__text">{m.confirm.replace('{name}', name)}</p>
                            <div className="ttm-confirm__actions">
                                <button
                                    className="lp-submit"
                                    type="button"
                                    onClick={() => void withdraw(ev)}
                                    disabled={busy !== null}
                                >
                                    {busy === ev.option ? m.saving : m.confirmYes}
                                </button>
                                <button
                                    className="ttm-cancel"
                                    type="button"
                                    onClick={() => setAsking(null)}
                                    disabled={busy !== null}
                                >
                                    {m.cancel}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="ttm-ev__actions">
                            <button
                                className="ttm-cancel"
                                type="button"
                                onClick={() => {
                                    setStatus(null);
                                    setAsking(ev.option);
                                }}
                                disabled={busy !== null}
                            >
                                {m.withdraw}
                            </button>
                        </div>
                    ))}

                {mine && (
                    <p
                        className={`ttm-status${mine.kind === 'error' ? ' ttm-status--error' : ''}`}
                        role={mine.kind === 'error' ? 'alert' : 'status'}
                    >
                        {mine.kind === 'error'
                            ? withEmail(m.error)
                            : mine.kind === 'confirmed'
                              ? m.todosSaved
                              : active.length === 0
                                ? m.allGone
                                : m.saved}
                    </p>
                )}
            </section>
        );
    };

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
                                {evenings.length === 0 ? (
                                    <p className="ttm-note">{withEmail(m.none)}</p>
                                ) : (
                                    <>
                                        <h2 className="lp-label ttm-legend">{m.legend}</h2>
                                        <div className="ttm-list">{evenings.map(renderEvening)}</div>
                                        <p className="ttm-note">
                                            {view.open ? `${m.asap} ${m.onlyRemove}` : withEmail(m.closed)}
                                        </p>
                                    </>
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
