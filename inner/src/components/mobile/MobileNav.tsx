'use client';
import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import RouterLink from 'next/link';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSiteFlags } from '@/api/SiteFlagsContext';
import './mobile.css';

const NAVY = '#0f2040';
// The nav uses the site's display face (Space Grotesk) via the CSS variable set
// on <html> in layout.tsx, matching the desktop TopNav.
const NAV_FONT = "var(--font-space-grotesk), 'Space Grotesk', system-ui, sans-serif";

const LANGUAGES: { code: 'de' | 'en'; label: string; flag: string }[] = [
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
];

const MobileNav: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    const pathname = usePathname();
    const { t, locale, setLocale } = useLanguage();
    const langRef = useRef<HTMLDivElement>(null);

    // Close the menu whenever the route changes.
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // Lock background scroll while the overlay is open.
    useEffect(() => {
        if (open) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = prev;
            };
        }
    }, [open]);

    // Close the language dropdown on outside click.
    useEffect(() => {
        if (!langOpen) return;
        const onDown = (e: MouseEvent) => {
            if (langRef.current && !langRef.current.contains(e.target as Node)) {
                setLangOpen(false);
            }
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [langOpen]);

    const { techTourListed } = useSiteFlags();
    const navLinks = [
        { to: '/partner', label: t.nav.partner },
        { to: '/projects', label: t.nav.projects },
        { to: '/team', label: t.nav.team },
        { to: '/sponsors', label: t.nav.sponsors },
        ...(techTourListed ? [{ to: '/techtour', label: t.nav.techtour }] : []),
        { to: '/#qa', label: t.nav.qa }, // FAQ stays a homepage section
        { to: '/contact', label: t.nav.contact },
    ];

    const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

    // On the landing the header overlays the hero image (transparent, white
    // ink) and flips its ink with the same html[data-nav] attribute the
    // landing's background scrub stamps — see mobile.css.
    const isLanding = pathname === '/';

    return (
        <>
            <header
                className={
                    'mobile-nav' + (isLanding ? ' mobile-nav--overlay' : '')
                }
                style={styles.header}
            >
                <div style={styles.brand}>
                    <RouterLink href="/" style={styles.logoLink} aria-label="Coding for Change">
                        <img
                            src="/images/logo.svg"
                            alt="Coding for Change"
                            className="mobile-nav__logo"
                            width={190}
                            height={26}
                            style={styles.logo}
                        />
                    </RouterLink>
                </div>
                <button
                    onClick={() => setOpen(true)}
                    style={styles.menuButton}
                    aria-label="Open menu"
                >
                    <span className="mobile-nav__line" style={styles.line} />
                    <span className="mobile-nav__line" style={styles.line} />
                    <span className="mobile-nav__line" style={styles.line} />
                </button>
            </header>

            {open && (
                <div className="mobile-menu-overlay" style={styles.overlay}>
                    <div style={styles.overlayHeader}>
                        <div style={styles.brand}>
                            <RouterLink
                                href="/"
                                style={styles.logoLink}
                                onClick={() => setOpen(false)}
                            >
                                <img
                                    src="/images/logo.svg"
                                    alt="Coding for Change"
                                    width={190}
                                    height={26}
                                    style={styles.logo}
                                />
                            </RouterLink>
                        </div>
                        <button
                            onClick={() => setOpen(false)}
                            style={styles.closeButton}
                            aria-label="Close menu"
                        >
                            ✕
                        </button>
                    </div>

                    <nav style={styles.nav}>
                        {navLinks.map((link, i) => (
                            <RouterLink
                                key={link.to}
                                href={link.to}
                                className="mobile-menu-item"
                                style={Object.assign({}, styles.navLink, {
                                    animationDelay: `${i * 0.05}s`,
                                })}
                                onClick={() => setOpen(false)}
                            >
                                {link.label}
                            </RouterLink>
                        ))}
                    </nav>

                    <RouterLink
                        href="/join"
                        className="mobile-menu-item"
                        style={Object.assign({}, styles.ctaButton, {
                            animationDelay: `${navLinks.length * 0.05}s`,
                        })}
                        onClick={() => setOpen(false)}
                    >
                        {t.nav.join}
                    </RouterLink>

                    <div
                        ref={langRef}
                        className="mobile-menu-item"
                        style={Object.assign({}, styles.langWrap, {
                            animationDelay: `${(navLinks.length + 1) * 0.05}s`,
                        })}
                    >
                        <button
                            style={styles.langToggle}
                            onClick={() => setLangOpen((o) => !o)}
                            aria-haspopup="listbox"
                            aria-expanded={langOpen}
                        >
                            <span>
                                {current.flag} {current.label}
                            </span>
                            <span style={styles.caret}>{langOpen ? '▴' : '▾'}</span>
                        </button>
                        {langOpen && (
                            <div style={styles.langMenu} role="listbox">
                                {LANGUAGES.map((lang) => (
                                    <button
                                        key={lang.code}
                                        role="option"
                                        aria-selected={lang.code === locale}
                                        style={Object.assign(
                                            {},
                                            styles.langOption,
                                            lang.code === locale && styles.langOptionActive
                                        )}
                                        onClick={() => {
                                            setLocale(lang.code);
                                            setLangOpen(false);
                                        }}
                                    >
                                        {lang.flag} {lang.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

const styles: StyleSheetCSS = {
    header: {
        // position / background / border live in mobile.css (.mobile-nav) so
        // the landing's overlay + ink-flip variants can override them.
        display: 'flex',
        top: 0,
        flexShrink: 0,
        zIndex: 100,
        padding: '0 20px',
        height: 60,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    brand: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
    },
    logoLink: {
        display: 'flex',
        alignItems: 'center',
        textDecoration: 'none',
        flexShrink: 0,
    },
    logo: {
        height: 30,
        width: 'auto',
        objectFit: 'contain',
    },
    menuButton: {
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        flexShrink: 0,
    },
    line: {
        // background lives in mobile.css (.mobile-nav__line) for the ink flip.
        display: 'block',
        width: 24,
        height: 2,
        borderRadius: 2,
        flexShrink: 0,
    },
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 500,
        background: '#ffffff',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 24px 32px',
    },
    overlayHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 60,
        flexShrink: 0,
        marginBottom: 16,
    },
    closeButton: {
        display: 'flex',
        width: 44,
        height: 44,
        border: `2px solid ${NAVY}`,
        borderRadius: 8,
        background: 'white',
        fontSize: 16,
        color: NAVY,
        cursor: 'pointer',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    nav: {
        display: 'flex',
        flexDirection: 'column',
    },
    navLink: {
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        padding: '16px 0',
        fontSize: 24,
        color: '#000',
        fontFamily: NAV_FONT,
        textDecoration: 'none',
        borderBottom: '1px solid #f0f0f0',
    },
    ctaButton: {
        display: 'flex',
        marginTop: 28,
        background: '#000000',
        color: '#ffffff',
        borderRadius: 32,
        padding: '18px 0',
        fontSize: 20,
        fontFamily: NAV_FONT,
        textDecoration: 'none',
        justifyContent: 'center',
        alignItems: 'center',
    },
    langWrap: {
        display: 'flex',
        position: 'relative',
        marginTop: 20,
        alignSelf: 'flex-start',
    },
    langToggle: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderRadius: 10,
        border: '1px solid #e5e7eb',
        background: '#ffffff',
        cursor: 'pointer',
        fontSize: 15,
        color: '#000',
        fontFamily: NAV_FONT,
    },
    caret: {
        fontSize: 12,
        color: '#6b7280',
    },
    langMenu: {
        display: 'flex',
        position: 'absolute',
        bottom: 'calc(100% + 6px)',
        left: 0,
        flexDirection: 'column',
        minWidth: '100%',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        zIndex: 10,
    },
    langOption: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: 15,
        color: '#000',
        fontFamily: NAV_FONT,
        whiteSpace: 'nowrap',
        textAlign: 'left',
    },
    langOptionActive: {
        background: '#f3f4f6',
    },
};

export default MobileNav;
