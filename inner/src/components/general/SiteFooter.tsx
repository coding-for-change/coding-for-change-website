'use client';
import React, { useEffect, useState } from 'react';
import RouterLink from 'next/link';
import { useSiteConfig, useLanguage } from '../../api';
import { useSiteFlags } from '@/api/SiteFlagsContext';
import { useDarkChrome } from '../../hooks/useDarkNav';
import {
    openConsentSettings,
    consentUiAvailable,
    onConsentUiChange,
} from '../../lib/consent';

const NAVY = '#0f2040';
const GRAY = '#6b7280';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

/**
 * The footer on a page that is dark from top to bottom — the TechTour, which
 * declares it with `useDarkNav`. Off-white on white would leave the footer
 * sitting under the page like a strip of paper taped to the bottom of a
 * screen, so it takes the stage's own colours (`.lp--techtour` and the Explore
 * panels in landing.css) rather than a generic dark grey.
 */
const DARK = {
    background: '#060d12',
    border: 'rgba(255, 255, 255, 0.08)',
    /* The logo is drawn in black; the nav flips it the same way. */
    logo: 'brightness(0) invert(1)',
    strong: '#ffffff',
    muted: 'rgba(255, 255, 255, 0.62)',
    faint: 'rgba(255, 255, 255, 0.38)',
} as const;

/**
 * Site-wide footer. Shared by the desktop site shell and the mobile layout —
 * with the Windows-95 desktop chrome (and its shortcuts) gone, this is now the
 * canonical way to reach the Imprint and Privacy pages. Labels are
 * localized (EN/DE) via the translation table. A centered max-width inner block
 * keeps it readable full-width on desktop and stacked on mobile.
 */
const SiteFooter: React.FC = () => {
    const siteConfig = useSiteConfig();
    const { t } = useLanguage();
    const { techTourListed } = useSiteFlags();
    const dark = useDarkChrome();
    /** A style from `styles`, with the dark page's override folded in if it has one. */
    const sx = (key: string): React.CSSProperties =>
        dark && darkStyles[key] ? { ...styles[key], ...darkStyles[key] } : styles[key];

    const f = t.footer;
    const PAGE_LINKS = [
        { to: '/', label: f.home },
        { to: '/projects', label: f.projects },
        { to: '/team', label: f.team },
        { to: '/#sponsors', label: f.sponsors },
        { to: '/partner', label: f.partner },
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

    return (
        <footer style={sx('footer')}>
            <div style={sx('inner')}>
                <div style={sx('top')}>
                    <img
                        src="/images/logo.svg"
                        alt="Coding for Change"
                        width={220}
                        height={30}
                        style={sx('logo')}
                    />
                    {siteConfig.tagline && (
                        <p style={sx('tagline')}>{siteConfig.tagline}</p>
                    )}
                    {siteConfig.email && (
                        <a href={`mailto:${siteConfig.email}`} style={sx('email')}>
                            {siteConfig.email}
                        </a>
                    )}
                </div>

                <div style={sx('columns')}>
                    <div style={sx('column')}>
                        <p style={sx('columnHeading')}>{f.pages.toUpperCase()}</p>
                        {PAGE_LINKS.map((link) => (
                            <RouterLink key={link.label} href={link.to} style={sx('columnLink')}>
                                {link.label}
                            </RouterLink>
                        ))}
                    </div>
                    <div style={sx('column')}>
                        <p style={sx('columnHeading')}>{f.info.toUpperCase()}</p>
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

            {siteConfig.copyrightText && (
                <div style={sx('copyrightWrap')}>
                    <div style={sx('divider')} />
                    <p style={sx('copyright')}>{siteConfig.copyrightText}</p>
                </div>
            )}
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
    logo: { filter: DARK.logo },
    tagline: { color: DARK.muted },
    email: { color: DARK.strong },
    columnHeading: { color: DARK.strong },
    columnLink: { color: DARK.muted },
    consentButton: { color: DARK.muted },
    divider: { backgroundColor: DARK.border },
    copyright: { color: DARK.faint },
};

const styles: StyleSheetCSS = {
    footer: {
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #f0f0f0',
        padding: '48px 24px 32px',
        width: '100%',
        boxSizing: 'border-box',
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
        gap: 12,
        flex: '1 1 260px',
        minWidth: 240,
    },
    logo: {
        height: 30,
        width: 'auto',
        objectFit: 'contain',
        alignSelf: 'flex-start',
    },
    tagline: {
        fontFamily: FONT,
        fontSize: 14,
        color: GRAY,
        lineHeight: 1.6,
        margin: 0,
        maxWidth: 280,
    },
    email: {
        fontFamily: FONT,
        fontSize: 14,
        color: NAVY,
        textDecoration: 'none',
    },
    columns: {
        display: 'flex',
        flexDirection: 'row',
        gap: 64,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
    },
    column: {
        display: 'flex',
        flexDirection: 'column',
    },
    columnHeading: {
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: 700,
        color: NAVY,
        letterSpacing: 1,
        margin: '0 0 16px 0',
    },
    columnLink: {
        display: 'flex',
        fontFamily: FONT,
        fontSize: 14,
        color: GRAY,
        textDecoration: 'none',
        padding: '6px 0',
    },
    consentButton: {
        display: 'flex',
        fontFamily: FONT,
        fontSize: 14,
        color: GRAY,
        textDecoration: 'none',
        padding: '6px 0',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
    },
    copyrightWrap: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: 1060,
        margin: '0 auto',
        boxSizing: 'border-box',
    },
    divider: {
        height: 1,
        backgroundColor: '#f0f0f0',
        margin: '32px 0 20px',
        width: '100%',
    },
    copyright: {
        fontFamily: FONT,
        fontSize: 12,
        color: '#9ca3af',
        margin: 0,
    },
};

export default SiteFooter;
