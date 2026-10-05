'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '../../contexts/LanguageContext';
import { APPLICATION_ROUND, applicationsOpen } from '../../lib/applicationPhase';
import './applyBar.css';

/**
 * The thin bar above the nav while the application round is open: "Applications
 * for Winter 2026/27 are open", the whole bar a link to /join. It follows the
 * dates in `lib/applicationPhase.ts`, so it appears and disappears on its own,
 * and it stays away from /join itself, where it would only repeat the page.
 *
 * On the mobile landing the header is a fixed overlay at the top of the
 * window, which would sit on top of this bar. There the bar publishes how much
 * of it is still on screen as `--apply-bar-offset`, and the overlay header
 * (mobile.css) sits that far down – so the two scroll up together and the
 * header ends at the top once the bar is gone.
 */
const ApplyBar: React.FC<{ variant?: 'desktop' | 'mobile' }> = ({ variant = 'desktop' }) => {
    const { t, locale } = useLanguage();
    const pathname = usePathname() ?? '/';
    const ref = useRef<HTMLAnchorElement>(null);
    const [now, setNow] = useState(() => Date.now());

    // A tab left open across the deadline should lose the bar without a reload.
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(id);
    }, []);

    const shown = applicationsOpen(now) && !pathname.startsWith('/join');

    useEffect(() => {
        const root = document.documentElement;
        if (!shown || variant !== 'mobile') {
            root.style.removeProperty('--apply-bar-offset');
            return;
        }
        const update = () => {
            const h = ref.current?.offsetHeight ?? 0;
            root.style.setProperty('--apply-bar-offset', `${Math.max(0, h - window.scrollY)}px`);
        };
        update();
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
            root.style.removeProperty('--apply-bar-offset');
        };
    }, [shown, variant]);

    if (!shown) return null;
    return (
        <Link ref={ref} href="/join" className={`apply-bar apply-bar--${variant}`}>
            <span className="apply-bar__dot" aria-hidden="true" />
            <span className="apply-bar__text">
                {t.nav.applyBar.replace('{round}', APPLICATION_ROUND[locale])}
            </span>
            <span className="apply-bar__cta">{t.nav.applyBarCta} →</span>
        </Link>
    );
};

export default ApplyBar;
