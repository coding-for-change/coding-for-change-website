'use client';
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
    applicationStatus,
    daysUntilDeadline,
    daysUntilOpening,
} from '../../lib/applicationPhase';
import './landing.css';
import './join.css';

/**
 * The application round's status pill — "Closes 30 Oct · 15 days left",
 * "Opens 5 Oct · in 3 days", or "Applications closed" — the same words and
 * dot colours as the chip on /join and the pill on /join/apply. Shown in the
 * homepage hero while the site is in student mode. `now` comes from the
 * caller so server and client render the same count.
 */
const RoundStatus: React.FC<{ now: number; className?: string }> = ({
    now,
    className,
}) => {
    const { t } = useLanguage();
    const status = applicationStatus(now);
    const c = t.join.countdown;
    const countdown = (() => {
        if (status === 'upcoming') {
            const n = daysUntilOpening(now);
            return n === 1 ? c.opensIn.one : c.opensIn.other.replace('{n}', String(n));
        }
        if (status === 'open') {
            const n = daysUntilDeadline(now);
            if (n === 0) return null;
            return n === 1 ? c.closesIn.one : c.closesIn.other.replace('{n}', String(n));
        }
        return null;
    })();
    return (
        <span
            className={
                `lp-round-status jn-status--${status}` +
                (status === 'closed' ? ' lp-round-status--closed' : '') +
                (className ? ` ${className}` : '')
            }
        >
            <span className="lp-round-status__dot" aria-hidden="true" />
            {t.join.status[status]}
            {countdown && (
                <>
                    <span className="lp-round-status__sep" aria-hidden="true">
                        ·
                    </span>
                    {countdown}
                </>
            )}
        </span>
    );
};

export default RoundStatus;
