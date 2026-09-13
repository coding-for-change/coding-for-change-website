'use client';
import React, { useEffect, useState } from 'react';
import RouterLink from 'next/link';
import { useSiteConfig, useLanguage } from '../../api';
import {
    openConsentSettings,
    consentUiAvailable,
    onConsentUiChange,
} from '../../lib/consent';

const NAVY = '#0f2040';
const GRAY = '#6b7280';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

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

    const f = t.footer;
    const PAGE_LINKS = [
        { to: '/', label: f.home },
        { to: '/projects', label: f.projects },
        { to: '/team', label: f.team },
        { to: '/#sponsors', label: f.sponsors },
        { to: '/partner', label: f.partner },
        { to: '/join', label: f.join },
        { to: '/techtour', label: f.techtour },
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
        <footer style={styles.footer}>
            <div style={styles.inner}>
                <div style={styles.top}>
                    <img
                        src="/images/logo.svg"
                        alt="Coding for Change"
                        width={220}
                        height={30}
                        style={styles.logo}
                    />
                    {siteConfig.tagline && (
                        <p style={styles.tagline}>{siteConfig.tagline}</p>
                    )}
                    {siteConfig.email && (
                        <a href={`mailto:${siteConfig.email}`} style={styles.email}>
                            {siteConfig.email}
                        </a>
                    )}
                </div>

                <div style={styles.columns}>
                    <div style={styles.column}>
                        <p style={styles.columnHeading}>{f.pages.toUpperCase()}</p>
                        {PAGE_LINKS.map((link) => (
                            <RouterLink key={link.label} href={link.to} style={styles.columnLink}>
                                {link.label}
                            </RouterLink>
                        ))}
                    </div>
                    <div style={styles.column}>
                        <p style={styles.columnHeading}>{f.info.toUpperCase()}</p>
                        {INFO_LINKS.map((link) => (
                            <RouterLink key={link.label} href={link.to} style={styles.columnLink}>
                                {link.label}
                            </RouterLink>
                        ))}
                        {showConsentLink && (
                            <button
                                type="button"
                                onClick={openConsentSettings}
                                style={styles.consentButton}
                            >
                                {f.cookieSettings}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {siteConfig.copyrightText && (
                <div style={styles.copyrightWrap}>
                    <div style={styles.divider} />
                    <p style={styles.copyright}>{siteConfig.copyrightText}</p>
                </div>
            )}
        </footer>
    );
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
