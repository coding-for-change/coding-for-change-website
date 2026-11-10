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
 * 3. Their documents, with the status of each, when DocuSeal is set up.
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
    const readIn = useRef<string>(initialLocale);

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

    const head = (title: string, lead?: React.ReactNode) => (
        <motion.div
            className="jn-apply__head ob-head"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <p className="lp-kicker">{o.kicker}</p>
            <h1 className="lp-page__title">{title}</h1>
            {lead}
        </motion.div>
    );

    const shell = (children: React.ReactNode) => (
        <div className="lp jn jn-apply ob">
            <div className="lp-page">
                <div className="lp-inner jn-apply__col">{children}</div>
            </div>
        </div>
    );

    if (!view) {
        return shell(
            <>
                {head(
                    o.signedOutTitle,
                    <p className="jn-apply__lead">{signedOut ? o.signedOutLead : withEmail(o.unavailable)}</p>
                )}
                {signedOut && (
                    <div className="ob-signin">
                        <a className="lp-submit ob-signin__btn" href={SIGN_IN_URL}>
                            {o.signIn}
                        </a>
                        <p className="ob-note">{withEmail(o.signInNote)}</p>
                    </div>
                )}
            </>
        );
    }

    const form = view.form;
    const todos = view.todos;
    const documents = view.documents.configured ? view.documents.items : [];
    const sections: { id: string; render: (n: number) => React.ReactNode }[] = [];

    if (form) {
        sections.push({
            id: 'form',
            render: (n) => (
                <section className="ob-section" aria-labelledby="ob-form">
                    <h2 className="ob-section__title" id="ob-form">
                        <span className="ob-section__num">{n}</span>
                        {o.formTitle}
                    </h2>
                    {editing ? (
                        <>
                            <p className="ob-section__lead">{o.formLead}</p>
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
                                <button className="ob-link" type="button" onClick={() => setEditing(false)}>
                                    {o.formCancel}
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="ob-done" role={justSent ? 'status' : undefined}>
                            {justSent && <p className="ob-done__thanks">{o.formThanks}</p>}
                            <p className="ob-done__line">
                                <span className="ob-check" aria-hidden="true">
                                    ✓
                                </span>
                                {form.sentAt ? o.formSentOn.replace('{date}', day(form.sentAt)) : o.formThanks}
                            </p>
                            {view.profile && (
                                <p className="ob-note">{view.profile.published ? o.profileLive : o.profileDraft}</p>
                            )}
                            <button
                                className="ob-link"
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
                </section>
            ),
        });
    }

    if (todos.length > 0) {
        sections.push({
            id: 'todos',
            render: (n) => (
                <section className="ob-section" aria-labelledby="ob-todos">
                    <h2 className="ob-section__title" id="ob-todos">
                        <span className="ob-section__num">{n}</span>
                        {o.todosTitle}
                    </h2>
                    <p className="ob-section__lead">{o.todosLead}</p>
                    <ul className="ob-list">
                        {todos.map((td) => (
                            <li key={td.id} className={`ob-item${td.done ? ' ob-item--done' : ''}`}>
                                <label className="ob-item__check">
                                    <input
                                        type="checkbox"
                                        checked={td.done}
                                        disabled={busy !== null}
                                        onChange={(e) => void tick(td, e.target.checked)}
                                    />
                                    <span className="ob-item__text">{td.text}</span>
                                </label>
                                {(td.linkUrl || (td.done && td.at)) && (
                                    <span className="ob-item__meta">
                                        {td.linkUrl && (
                                            <a href={td.linkUrl} target="_blank" rel="noopener noreferrer">
                                                {td.linkLabel || o.openLink} ↗
                                            </a>
                                        )}
                                        {td.done && td.at && (
                                            <span className="ob-item__when">
                                                {o.todoDoneOn.replace('{date}', day(td.at))}
                                            </span>
                                        )}
                                    </span>
                                )}
                                {todoError === td.id && (
                                    <p className="ob-item__error" role="alert">
                                        {o.todoError}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            ),
        });
    }

    const docStatus = (d: MemberDocument) => {
        const key = d.status as keyof typeof o.docStatus;
        const text = o.docStatus[key] ?? d.status;
        if (!text.includes('{date}')) return text;
        return d.completedAt ? text.replace('{date}', day(d.completedAt)) : text.replace(/\s*\{date\}/, '');
    };

    if (documents.length > 0) {
        sections.push({
            id: 'documents',
            render: (n) => (
                <section className="ob-section" aria-labelledby="ob-docs">
                    <h2 className="ob-section__title" id="ob-docs">
                        <span className="ob-section__num">{n}</span>
                        {o.docsTitle}
                    </h2>
                    <p className="ob-section__lead">{o.docsLead}</p>
                    <ul className="ob-list">
                        {documents.map((d) => (
                            <li key={d.id} className={`ob-item${d.status === 'completed' ? ' ob-item--done' : ''}`}>
                                <span className="ob-item__title">{d.title}</span>
                                {d.description && <span className="ob-item__desc">{d.description}</span>}
                                <span className={`ob-pill ob-pill--${d.status === 'completed' ? 'done' : 'open'}`}>
                                    {d.status === 'completed' && '✓ '}
                                    {docStatus(d)}
                                </span>
                            </li>
                        ))}
                    </ul>
                    {documents.some((d) => d.status !== 'completed') && <p className="ob-note">{o.docsLater}</p>}
                </section>
            ),
        });
    }

    return shell(
        <>
            {head(
                o.title,
                <>
                    {view.intro ? (
                        view.intro
                            .split(/\n{2,}/)
                            .map((p, i) => (
                                <p key={i} className="jn-apply__lead ob-intro">
                                    {p}
                                </p>
                            ))
                    ) : null}
                    <p className="ob-who">
                        <span>{o.signedInAs.replace('{email}', view.member.email)}</span>
                        <button className="ob-link" type="button" onClick={() => void signOut()} disabled={leaving}>
                            {leaving ? o.signingOut : o.signOut}
                        </button>
                    </p>
                </>
            )}

            <motion.div
                className="jn-apply__main ob-main"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
            >
                {view.stepsDone && (
                    <div className="ob-allset" role="status">
                        <p className="ob-allset__title">{o.doneTitle}</p>
                        <p className="ob-allset__text">{o.doneText}</p>
                    </div>
                )}
                {sections.map((s, i) => (
                    <React.Fragment key={s.id}>{s.render(i + 1)}</React.Fragment>
                ))}
                <p className="jn-apply__contact">{withEmail(o.contact)}</p>
            </motion.div>
        </>
    );
};

export default Onboarding;
