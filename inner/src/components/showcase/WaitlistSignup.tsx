'use client';
import React, { useRef, useState } from 'react';
import { submitWaitlist } from '../../api';
import { getAttribution } from '../../lib/attribution';
import { trackConversion, trackFormStart } from '../../lib/analytics';
import { trackAdsConversion } from '../../lib/googleAds';
import { useLanguage } from '../../contexts/LanguageContext';
import './join.css';

const validateEmail = (email: string) => {
    const re =
        // eslint-disable-next-line
        /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
};

/**
 * "Notify me when applications open": one email field, saved to the CMS
 * `waitlist-signups` collection. /join/apply shows it in place of the form
 * while the round has not started or is over. Funnel: `form_start` on first
 * focus, then the `waitlist` conversion and Google Ads action on success.
 */
const WaitlistSignup: React.FC<{ title: string; lead: string }> = ({ title, lead }) => {
    const { t, locale } = useLanguage();
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(false);
    const valid = validateEmail(email);

    const started = useRef(false);
    const handleFocus = () => {
        if (started.current) return;
        started.current = true;
        trackFormStart('waitlist');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!valid || submitting) return;
        setError(false);
        setSubmitting(true);
        try {
            await submitWaitlist(email.trim(), locale, getAttribution());
            setSubmitted(true);
            trackConversion('waitlist');
            trackAdsConversion('waitlist');
        } catch {
            setError(true);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="jn-waitlist">
            <h2 className="jn-waitlist__title">{title}</h2>
            <p className="jn-waitlist__lead">{lead}</p>
            {submitted ? (
                <p className="jn-waitlist__done" role="status">
                    <span aria-hidden="true">✓</span> {t.join.waitlistSuccess}
                </p>
            ) : (
                <form className="jn-waitlist__form" onSubmit={handleSubmit} onFocus={handleFocus}>
                    <label className="lp-label" htmlFor="jn-waitlist-email">
                        {t.join.waitlistEmailLabel}
                    </label>
                    <div className="jn-waitlist__row">
                        <input
                            id="jn-waitlist-email"
                            className="lp-input"
                            type="email"
                            autoComplete="email"
                            placeholder={t.join.waitlistEmailPlaceholder}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <button className="lp-submit" type="submit" disabled={!valid || submitting}>
                            {submitting ? t.join.waitlistSubmitting : t.join.waitlistButton}
                        </button>
                    </div>
                    {error && <p className="lp-form-note lp-required">{t.join.waitlistError}</p>}
                </form>
            )}
        </div>
    );
};

export default WaitlistSignup;
