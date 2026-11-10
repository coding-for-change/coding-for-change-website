'use client';
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { MemberDocument, MemberOnboardingView, MemberTodo } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import CmsForm from '../forms/CmsForm';
import './landing.css';
import './join.css';
import './onboarding.css';

const CONTACT_EMAIL = 'info@codingforchange.com';
const SIGN_IN_URL = '/api/auth/google?redirect=/onboarding';

/** The same rules the CMS applies (inner/cms/src/lib/onboarding/memberForm.ts). */
const GITHUB_RE = /^[A-Za-z0-9-]{1,39}$/;
const githubOk = (raw: string) => {
    const link = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)\/?$/i.exec(raw.trim());
    const v = (link ? link[1] : raw.trim()).replace(/^@/, '');
    return GITHUB_RE.test(v) && !v.startsWith('-') && !v.endsWith('-') && !v.includes('--');
};
const linkedinOk = (raw: string) => {
    let v = raw.trim();
    if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
    try {
        const url = new URL(v);
        const host = url.hostname.toLowerCase();
        return (
            (host === 'linkedin.com' || host.endsWith('.linkedin.com')) &&
            !url.username &&
            !url.password &&
            !url.port &&
            /^\/(in|pub|company)\/[^/]+/.test(url.pathname)
        );
    } catch {
        return false;
    }
};

export interface OnboardingProps {
    /** Read on the server for this visitor's session; null when signed out or the CMS is down. */
    initialView: MemberOnboardingView | null;
    /** True when the CMS knows no session for this visitor (as opposed to being unreachable). */
    signedOut: boolean;
    initialLocale: 'en' | 'de';
}

/**
 * /onboarding: a new member's own page after the board admitted them, behind
 * Google sign-in (the CMS's session cookie). Three parts, each left out when
 * the board has set nothing for it:
 *
 * 1. The onboarding form, chosen in the CMS (Onboarding Settings) and
 *    rendered by the shared CmsForm, photo upload included. Sent once, it
 *    folds up into a line with the date and a way to send it again,
 *    starting from the last answers. No draft is kept in the browser.
 * 2. Their to-dos: a tick or untick is saved straight away.
 * 3. Their documents, when DocuSeal is set up: a button per document asks
 *    the CMS for the member's own signing link (it starts the DocuSeal
 *    submission the first time) and opens it in a new tab. No iframe and no
 *    DocuSeal script on this page: DocuSeal is a plain link to the
 *    association's own instance. Coming back to this tab reads the state
 *    again (the CMS asks DocuSeal for open documents).
 *
 * Signed out: a short explanation and "Sign in with Google", which comes
 * back here. Same light page as /join/apply.
 */
const Onboarding: React.FC<OnboardingProps> = ({ initialView, signedOut, initialLocale }) => {
    const { t, locale } = useLanguage();
    const o = t.onboarding;
    const [view, setView] = useState(initialView);
    const [editing, setEditing] = useState(() => !initialView?.form?.sentAt);
    const [formKey, setFormKey] = useState(0);
    const [justSent, setJustSent] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [todoError, setTodoError] = useState<string | null>(null);
    const [leaving, setLeaving] = useState(false);
    const [signing, setSigning] = useState<string | null>(null);
    const [docError, setDocError] = useState<{ id: string; text: 'error' | 'unavailable' } | null>(null);
    const [blocked, setBlocked] = useState<{ id: string; url: string } | null>(null);
    const readIn = useRef<string>(initialLocale);
    const lastRefresh = useRef(0);

    const load = async (lang: string) => {
        const res = await fetch(`/api/onboarding/me?locale=${lang}`, {
            cache: 'no-store',
            credentials: 'same-origin',
        });
        if (res.status === 401) {
            window.location.reload();
            return null;
        }
        if (!res.ok) return null;
        const next = (await res.json()) as MemberOnboardingView;
        setView(next);
        return next;
    };

    // Back from signing in the other tab: read the documents again, from
    // DocuSeal (POST /documents/refresh) while one is still open.
    const hasOpenDoc = Boolean(
        view?.documents.configured && view.documents.items.some((d) => d.status === 'pending' || d.status === 'opened')
    );
    useEffect(() => {
        if (!hasOpenDoc) return;
        const onBack = () => {
            if (document.visibilityState !== 'visible' || Date.now() - lastRefresh.current < 5000) return;
            lastRefresh.current = Date.now();
            fetch('/api/onboarding/documents/refresh', {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locale: readIn.current }),
            })
                .then(async (res) => {
                    if (res.status === 401) window.location.reload();
                    else if (res.ok) setView((await res.json()) as MemberOnboardingView);
                })
                .catch(() => undefined);
        };
        document.addEventListener('visibilitychange', onBack);
        window.addEventListener('focus', onBack);
        return () => {
            document.removeEventListener('visibilitychange', onBack);
            window.removeEventListener('focus', onBack);
        };
    }, [hasOpenDoc]);

    const sign = async (d: MemberDocument) => {
        if (signing) return;
        setSigning(d.id);
        setDocError(null);
        setBlocked(null);
        // Opened right in the click, before the request: a tab opened after
        // an await counts as a pop-up and is blocked by most browsers.
        const tab = window.open('', '_blank');
        if (tab) tab.opener = null;
        try {
            const res = await fetch(`/api/onboarding/documents/${encodeURIComponent(d.id)}/start`, {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locale }),
            });
            if (res.status === 401) {
                tab?.close();
                window.location.reload();
                return;
            }
            if (res.status === 404 || res.status === 409) {
                // Gone from the settings, or signed already: show the current state.
                tab?.close();
                await load(locale);
                return;
            }
            if (!res.ok) {
                tab?.close();
                setDocError({ id: d.id, text: res.status === 503 ? 'unavailable' : 'error' });
                return;
            }
            const answer = (await res.json()) as { url: string; view: MemberOnboardingView };
            setView(answer.view);
            if (tab && !tab.closed) tab.location.href = answer.url;
            else setBlocked({ id: d.id, url: answer.url });
        } catch {
            tab?.close();
            setDocError({ id: d.id, text: 'error' });
        } finally {
            setSigning(null);
        }
    };

    // Texts come from the CMS in one language: switching reads them again.
    useEffect(() => {
        if (!view || locale === readIn.current) return;
        readIn.current = locale;
        load(locale).catch(() => undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locale, view]);

    const dateLocale = locale === 'de' ? 'de-DE' : 'en-GB';
    const day = (iso: string) =>
        new Date(iso).toLocaleDateString(dateLocale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'Europe/Berlin',
        });
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

    const signOut = async () => {
        setLeaving(true);
        try {
            await fetch('/api/users/logout', { method: 'POST', credentials: 'same-origin' });
        } finally {
            window.location.reload();
        }
    };

    const tick = async (todo: MemberTodo, done: boolean) => {
        setBusy(todo.id);
        setTodoError(null);
        try {
            const res = await fetch('/api/onboarding/me/check', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item: todo.id, done, locale }),
            });
            if (res.status === 401) {
                window.location.reload();
                return;
            }
            if (res.status === 404) {
                await load(locale);
                return;
            }
            if (!res.ok) throw new Error(String(res.status));
            setView((await res.json()) as MemberOnboardingView);
        } catch {
            setTodoError(todo.id);
        } finally {
            setBusy(null);
        }
    };

    const shell = (children: React.ReactNode) => (
        <div className="lp jn jn-apply ob">
            <div className="lp-page">
                <motion.div
                    className="ob-shell"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    {children}
                </motion.div>
            </div>
        </div>
    );

    if (!view) {
        return shell(
            <div className="ob-gate">
                <div className="ob-card ob-gate__card">
                    <p className="ob-kicker">{o.kicker}</p>
                    <h1 className="ob-gate__title">{o.signedOutTitle}</h1>
                    <p className="ob-muted">{signedOut ? o.signedOutLead : withEmail(o.unavailable)}</p>
                    {signedOut && (
                        <>
                            <a className="ob-btn ob-btn--primary ob-btn--wide" href={SIGN_IN_URL}>
                                {o.signIn}
                            </a>
                            <p className="ob-muted ob-muted--small">{withEmail(o.signInNote)}</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    const form = view.form;
    const todos = view.todos;
    const documents = view.documents.configured ? view.documents.items : [];

    // What the cards at the top count: the form is one step, every to-do and
    // every document another.
    const todosDone = todos.filter((td) => td.done).length;
    const docsDone = documents.filter((d) => d.status === 'completed').length;
    const formSent = Boolean(form?.sentAt);
    const total = (form ? 1 : 0) + todos.length + documents.length;
    const done = (formSent ? 1 : 0) + todosDone + docsDone;
    const share = total ? Math.round((done / total) * 100) : 100;
    const left = (open: number) => (open ? o.statLeft.replace('{n}', String(open)) : o.statAllDone);

    const docStatus = (d: MemberDocument) => {
        const key = d.status as keyof typeof o.docStatus;
        const text = o.docStatus[key] ?? d.status;
        if (!text.includes('{date}')) return text;
        return d.completedAt ? text.replace('{date}', day(d.completedAt)) : text.replace(/\s*\{date\}/, '');
    };

    const badge = (ok: boolean, text: string) => (
        <span className={`ob-badge${ok ? ' ob-badge--ok' : ''}`}>
            {ok && <span aria-hidden="true">✓ </span>}
            {text}
        </span>
    );

    const name = view.member.firstName?.trim();
    const initials =
        `${view.member.firstName?.[0] ?? ''}${view.member.lastName?.[0] ?? ''}`.toUpperCase() ||
        view.member.email[0].toUpperCase();

    return shell(
        <>
            <header className="ob-top">
                <div className="ob-top__text">
                    <p className="ob-kicker">{o.kicker}</p>
                    <h1 className="ob-title">{name ? o.hello.replace('{name}', name) : o.title}</h1>
                    {view.intro
                        ? view.intro.split(/\n{2,}/).map((p, i) => (
                              <p key={i} className="ob-muted ob-top__lead">
                                  {p}
                              </p>
                          ))
                        : null}
                </div>
                <div className="ob-account">
                    <span className="ob-avatar" aria-hidden="true">
                        {initials}
                    </span>
                    <span className="ob-account__mail" title={o.signedInAs.replace('{email}', view.member.email)}>
                        {view.member.email}
                    </span>
                    <button
                        className="ob-btn ob-btn--outline"
                        type="button"
                        onClick={() => void signOut()}
                        disabled={leaving}
                    >
                        {leaving ? o.signingOut : o.signOut}
                    </button>
                </div>
            </header>

            {view.stepsDone && (
                <div className="ob-alert" role="status">
                    <span className="ob-alert__icon" aria-hidden="true">
                        ✓
                    </span>
                    <div className="ob-alert__body">
                        <p className="ob-alert__title">{o.doneTitle}</p>
                        <p className="ob-muted">{o.doneText}</p>
                    </div>
                </div>
            )}

            <div className="ob-stats">
                <div className="ob-card ob-stat ob-stat--wide">
                    <p className="ob-stat__label">{o.statProgress}</p>
                    <p className="ob-stat__value">
                        {share}
                        <span className="ob-stat__unit"> %</span>
                    </p>
                    <div
                        className="ob-progress"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={share}
                        aria-label={o.statProgress}
                    >
                        <span className="ob-progress__bar" style={{ width: `${share}%` }} />
                    </div>
                    <p className="ob-stat__sub">
                        {o.statSteps.replace('{done}', String(done)).replace('{total}', String(total))}
                    </p>
                </div>
                {form && (
                    <div className="ob-card ob-stat">
                        <p className="ob-stat__label">{o.formTitle}</p>
                        <p className="ob-stat__value">{formSent ? o.statSent : o.statOpen}</p>
                        <p className="ob-stat__sub">
                            {form.sentAt ? o.statOn.replace('{date}', day(form.sentAt)) : o.statFormHint}
                        </p>
                    </div>
                )}
                {todos.length > 0 && (
                    <div className="ob-card ob-stat">
                        <p className="ob-stat__label">{o.todosTitle}</p>
                        <p className="ob-stat__value">
                            {todosDone}
                            <span className="ob-stat__unit"> / {todos.length}</span>
                        </p>
                        <p className="ob-stat__sub">{left(todos.length - todosDone)}</p>
                    </div>
                )}
                {documents.length > 0 && (
                    <div className="ob-card ob-stat">
                        <p className="ob-stat__label">{o.docsTitle}</p>
                        <p className="ob-stat__value">
                            {docsDone}
                            <span className="ob-stat__unit"> / {documents.length}</span>
                        </p>
                        <p className="ob-stat__sub">{left(documents.length - docsDone)}</p>
                    </div>
                )}
            </div>

            <div className={`ob-grid${form && (todos.length > 0 || documents.length > 0) ? ' ob-grid--two' : ''}`}>
                {form && (
                    <section className="ob-section" aria-labelledby="ob-form">
                        <div className="ob-section__head">
                            <h2 className="ob-section__title" id="ob-form">
                                {o.formTitle}
                            </h2>
                            {badge(formSent, formSent ? o.statSent : o.statOpen)}
                        </div>
                        <div className="ob-card ob-card--pad">
                            {editing ? (
                                <>
                                    <p className="ob-muted ob-card__lead">{o.formLead}</p>
                                    <CmsForm
                                        key={`${formKey}-${locale}`}
                                        form={form.doc}
                                        untracked
                                        initialValues={form.previous}
                                        checks={{
                                            githubUsername: (v) => (githubOk(v) ? null : o.githubInvalid),
                                            linkedin: (v) => (linkedinOk(v) ? null : o.linkedinInvalid),
                                        }}
                                        textLimits={{ bio: 1500 }}
                                        onSubmitted={() => {
                                            setJustSent(true);
                                            setEditing(false);
                                            void load(locale);
                                        }}
                                    />
                                    {form.sentAt && (
                                        <button
                                            className="ob-btn ob-btn--ghost"
                                            type="button"
                                            onClick={() => setEditing(false)}
                                        >
                                            {o.formCancel}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="ob-sent" role={justSent ? 'status' : undefined}>
                                    <div className="ob-sent__text">
                                        <p className="ob-sent__line">
                                            {form.sentAt
                                                ? o.formSentOn.replace('{date}', day(form.sentAt))
                                                : o.formThanks}
                                        </p>
                                        {justSent && <p className="ob-muted">{o.formThanks}</p>}
                                        {view.profile && (
                                            <p className="ob-muted">
                                                {view.profile.published ? o.profileLive : o.profileDraft}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        className="ob-btn ob-btn--outline"
                                        type="button"
                                        onClick={() => {
                                            setFormKey((k) => k + 1);
                                            setJustSent(false);
                                            setEditing(true);
                                        }}
                                    >
                                        {o.formChange}
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {(todos.length > 0 || documents.length > 0) && (
                    <div className="ob-side">
                        {todos.length > 0 && (
                            <section className="ob-section" aria-labelledby="ob-todos">
                                <div className="ob-section__head">
                                    <h2 className="ob-section__title" id="ob-todos">
                                        {o.todosTitle}
                                    </h2>
                                    {badge(todosDone === todos.length, `${todosDone} / ${todos.length}`)}
                                </div>
                                <ul className="ob-card ob-rows">
                                    {todos.map((td) => (
                                        <li key={td.id} className={`ob-row${td.done ? ' ob-row--done' : ''}`}>
                                            <label className="ob-row__check">
                                                <input
                                                    type="checkbox"
                                                    checked={td.done}
                                                    disabled={busy !== null}
                                                    onChange={(e) => void tick(td, e.target.checked)}
                                                />
                                                <span className="ob-row__text">{td.text}</span>
                                            </label>
                                            {(td.linkUrl || (td.done && td.at)) && (
                                                <span className="ob-row__meta">
                                                    {td.linkUrl && (
                                                        <a href={td.linkUrl} target="_blank" rel="noopener noreferrer">
                                                            {td.linkLabel || o.openLink} ↗
                                                        </a>
                                                    )}
                                                    {td.done && td.at && (
                                                        <span>{o.todoDoneOn.replace('{date}', day(td.at))}</span>
                                                    )}
                                                </span>
                                            )}
                                            {todoError === td.id && (
                                                <p className="ob-row__error" role="alert">
                                                    {o.todoError}
                                                </p>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                <p className="ob-muted ob-muted--small ob-section__foot">{o.todosLead}</p>
                            </section>
                        )}

                        {documents.length > 0 && (
                            <section className="ob-section" aria-labelledby="ob-docs">
                                <div className="ob-section__head">
                                    <h2 className="ob-section__title" id="ob-docs">
                                        {o.docsTitle}
                                    </h2>
                                    {badge(docsDone === documents.length, `${docsDone} / ${documents.length}`)}
                                </div>
                                <ul className="ob-card ob-rows">
                                    {documents.map((d) => (
                                        <li key={d.id} className="ob-row">
                                            <div className="ob-row__split">
                                                <div className="ob-row__main">
                                                    <span className="ob-row__title">{d.title}</span>
                                                    {d.description && <span className="ob-muted">{d.description}</span>}
                                                    {badge(d.status === 'completed', docStatus(d))}
                                                </div>
                                                {d.status !== 'completed' && (
                                                    <button
                                                        type="button"
                                                        className="ob-btn ob-btn--primary"
                                                        disabled={signing !== null}
                                                        onClick={() => void sign(d)}
                                                    >
                                                        {signing === d.id
                                                            ? o.signOpening
                                                            : d.status === 'pending' || d.status === 'opened'
                                                              ? o.signContinue
                                                              : d.status === 'declined' || d.status === 'expired'
                                                                ? o.signAgain
                                                                : o.signStart}{' '}
                                                        ↗
                                                    </button>
                                                )}
                                            </div>
                                            {blocked?.id === d.id && (
                                                <p className="ob-muted ob-muted--small" role="status">
                                                    {o.signBlocked}{' '}
                                                    <a href={blocked.url} target="_blank" rel="noopener noreferrer">
                                                        {o.signOpenLink} ↗
                                                    </a>
                                                </p>
                                            )}
                                            {docError?.id === d.id && (
                                                <p className="ob-row__error ob-row__error--flush" role="alert">
                                                    {docError.text === 'unavailable'
                                                        ? withEmail(o.signUnavailable)
                                                        : o.signError}
                                                </p>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                <p className="ob-muted ob-muted--small ob-section__foot">
                                    {documents.some((d) => d.status !== 'completed') ? o.docsHint : o.docsLead}
                                </p>
                            </section>
                        )}
                    </div>
                )}
            </div>

            <p className="ob-muted ob-contact">{withEmail(o.contact)}</p>
        </>
    );
};

export default Onboarding;
