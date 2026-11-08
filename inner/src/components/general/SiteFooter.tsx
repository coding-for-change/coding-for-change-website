'use client';
import React, { useEffect, useState } from 'react';
import RouterLink from 'next/link';
import { useSiteConfig, useLanguage } from '../../api';
import { useSiteFlags } from '@/api/SiteFlagsContext';
import { useChromeTone } from '../../hooks/useDarkNav';
import type { PageTone } from '../../hooks/useDarkNav';
import useIsMobile from '../../hooks/useIsMobile';
import {
    openConsentSettings,
    consentUiAvailable,
    onConsentUiChange,
} from '../../lib/consent';

/* Brand tokens (index.css). */
const INK = 'var(--cfc-ink)';
const GREY = 'var(--cfc-grey)';
const LINE = 'var(--cfc-line)';
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

/**
 * The footer on a page that is dark from top to bottom – /techtour/apply, which
 * declares it with `useDarkNav`. Off-white on white would leave the footer
 * sitting under the page like a strip of paper taped to the bottom of a
 * screen, so it takes the stage's own colours (`.lp--techtour` in
 * landing.css) rather than a generic dark grey.
 */
const DARK = {
    background: '#060d12',
    border: 'rgba(255, 255, 255, 0.08)',
    strong: '#ffffff',
    muted: 'rgba(255, 255, 255, 0.62)',
    faint: 'rgba(255, 255, 255, 0.38)',
} as const;

/**
 * The footer under the tour page (/techtour), which keeps its own, warmer
 * paper (`--tt-paper` in techtour.css): the footer takes that ground so it
 * does not read as a second strip of paper. Only the ground and the rule
 * change.
 */
const PAPER = {
    background: '#f2efe7',
    border: '#e2ded3',
} as const;

/**
 * Site-wide footer, shared by the desktop site shell and the mobile layout:
 * the canonical way to reach Contact, Q&A, Imprint and Privacy, the cookie
 * settings, and the way into the 3D version. Labels are localized (EN/DE).
 *
 * Styled inline on purpose: the tone overrides below come from
 * `useChromeTone`, and html[data-nav] (which the nav follows) also flips
 * while the landing scrolls past its dark bands – the footer must not.
 */
const SiteFooter: React.FC = () => {
    const siteConfig = useSiteConfig();
    const { t } = useLanguage();
    const { techTourListed } = useSiteFlags();
    const tone = useChromeTone();
    const isMobile = useIsMobile();
    /** A style from `styles`, with the page tone's override folded in if it has one. */
    const sx = (key: string): React.CSSProperties => {
        const override = tone ? toneStyles[tone][key] : undefined;
        return override ? { ...styles[key], ...override } : styles[key];
    };

    const f = t.footer;
    const PAGE_LINKS = [
        { to: '/', label: f.home },
        { to: '/projects', label: f.projects },
        { to: '/team', label: f.team },
        { to: '/partners', label: f.partners },
        { to: '/ngos', label: f.ngos },
        { to: '/join', label: f.join },
        ...(techTourListed ? [{ to: '/techtour', label: f.techtour }] : []),
    ];

    const INFO_LINKS = [
        { to: '/contact', label: f.contact },
        { to: '/qa', label: f.qa },
        { to: '/privacy', label: f.privacy },
        { to: '/imprint', label: f.imprint },
    ];

    /**
     * GDPR Art. 7(3): withdrawing consent must be as easy as giving it, so the
     * banner needs a permanent way back. Only rendered once the CMP has actually
     * registered its dialog — a dead link would be worse than none. The consent
     * subscription is what re-renders us when that happens.
     */
    const [showConsentLink, setShowConsentLink] = useState(false);
    useEffect(
        () => onConsentUiChange(() => setShowConsentLink(consentUiAvailable())),
        []
    );

    /**
     * The way into the 3D scene. Not on a phone (the scene redirects mobile
     * visitors back to /) and not inside the scene's monitor, where the nav
     * carries the way out. Resolved after mount: window.top is unreadable
     * server-side.
     */
    const [embedded, setEmbedded] = useState(true);
    useEffect(() => {
        try {
            setEmbedded(window.self !== window.top);
        } catch {
            setEmbedded(true);
        }
    }, []);
    const show3d = !embedded && !isMobile;

    return (
        <footer style={sx('footer')}>
            <div style={sx('inner')}>
                <div style={sx('top')}>
                    <RouterLink href="/" aria-label="Coding for Change" style={styles.logoLink}>
                        <img src="/images/logo.svg" alt="Coding for Change" style={sx('logo')} />
                    </RouterLink>
                    {siteConfig.tagline && <p style={sx('tagline')}>{siteConfig.tagline}</p>}
                    {siteConfig.email && (
                        <a href={`mailto:${siteConfig.email}`} style={sx('email')}>
                            {siteConfig.email}
                        </a>
                    )}
                </div>

                <div style={sx('columns')}>
                    <div style={sx('column')}>
                        <p style={sx('columnHeading')}>{f.pages}</p>
                        {PAGE_LINKS.map((link) => (
                            <RouterLink key={link.label} href={link.to} style={sx('columnLink')}>
                                {link.label}
                            </RouterLink>
                        ))}
                    </div>
                    <div style={sx('column')}>
                        <p style={sx('columnHeading')}>{f.info}</p>
                        {INFO_LINKS.map((link) => (
                            <RouterLink key={link.label} href={link.to} style={sx('columnLink')}>
                                {link.label}
                            </RouterLink>
                        ))}
                        {showConsentLink && (
                            <button
                                type="button"
                                onClick={openConsentSettings}
                                style={sx('consentButton')}
                            >
                                {f.cookieSettings}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div style={sx('bottom')}>
                <div style={sx('divider')} />
                <div style={sx('bottomRow')}>
                    {siteConfig.copyrightText && (
                        <p style={sx('copyright')}>{siteConfig.copyrightText}</p>
                    )}
                    {show3d && (
                        <a href="/3d" style={sx('threeD')}>
                            {t.common.enterThreeD} →
                        </a>
                    )}
                </div>
            </div>
        </footer>
    );
};

/**
 * What changes on a dark page — nothing else is repeated, so the light footer
 * stays the one description of the layout.
 */
const darkStyles: StyleSheetCSS = {
    footer: {
        backgroundColor: DARK.background,
        borderTopColor: DARK.border,
    },
    tagline: { color: DARK.strong },
    email: { color: DARK.muted },
    columnHeading: { color: DARK.faint },
    columnLink: { color: DARK.muted },
    consentButton: { color: DARK.muted },
    divider: { backgroundColor: DARK.border },
    copyright: { color: DARK.faint },
    threeD: { color: DARK.muted },
    logo: { filter: 'brightness(0) invert(1)' },
};

/** What changes on the paper page. */
const paperStyles: StyleSheetCSS = {
    footer: {
        backgroundColor: PAPER.background,
        borderTopColor: PAPER.border,
    },
    divider: { backgroundColor: PAPER.border },
};

const toneStyles: Record<PageTone, StyleSheetCSS> = { dark: darkStyles, paper: paperStyles };

const styles: StyleSheetCSS = {
    footer: {
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--cfc-paper)',
        // Spelled out rather than the `borderTop` shorthand: the dark page
        // overrides the colour alone, and React warns (rightly) that dropping
        // a longhand on re-render while a shorthand still sets it can leave
        // the wrong value behind. Every override in `darkStyles` names the
        // same property its light counterpart does.
        borderTopWidth: 1,
        borderTopStyle: 'solid',
        borderTopColor: LINE,
        padding: '64px 24px 32px',
        width: '100%',
        boxSizing: 'border-box',
        // A child of the .site-scroll flex column: never let it be squeezed.
        flexShrink: 0,
    },
    inner: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 48,
        width: '100%',
        maxWidth: 1060,
        margin: '0 auto',
        boxSizing: 'border-box',
        justifyContent: 'space-between',
    },
    top: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        flex: '1 1 300px',
        minWidth: 240,
    },
    logoLink: {
        display: 'flex',
        alignSelf: 'flex-start',
        marginBottom: 6,
    },
    logo: {
        display: 'block',
        height: 30,
        width: 'auto',
    },
    tagline: {
        fontFamily: SANS,
        fontSize: 20,
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: '-0.025em',
        color: INK,
        margin: 0,
        maxWidth: 380,
    },
    email: {
        fontFamily: MONO,
        fontSize: 13,
        color: GREY,
        textDecoration: 'none',
        alignSelf: 'flex-start',
    },
    columns: {
        display: 'flex',
        flexDirection: 'row',
        gap: 72,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
    },
    column: {
        display: 'flex',
        flexDirection: 'column',
    },
    columnHeading: {
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: 400,
        color: GREY,
        margin: '0 0 14px 0',
    },
    columnLink: {
        display: 'flex',
        fontFamily: SANS,
        fontSize: 15,
        color: INK,
        textDecoration: 'none',
        padding: '5px 0',
    },
    consentButton: {
        display: 'flex',
        fontFamily: SANS,
        fontSize: 15,
        color: INK,
        textDecoration: 'none',
        padding: '5px 0',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
    },
    bottom: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: 1060,
        margin: '0 auto',
        boxSizing: 'border-box',
    },
    divider: {
        height: 1,
        backgroundColor: LINE,
        margin: '48px 0 18px',
        width: '100%',
    },
    bottomRow: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: '8px 24px',
    },
    copyright: {
        fontFamily: SANS,
        fontSize: 13,
        color: GREY,
        margin: 0,
    },
    threeD: {
        fontFamily: MONO,
        fontSize: 12,
        color: GREY,
        textDecoration: 'none',
    },
};

export default SiteFooter;
