'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useIsMobile from '../../hooks/useIsMobile';
import { BoxIcon, BoxIconHandle } from './BoxIcon';

export interface Enter3DButtonProps {
    containerStyle?: React.CSSProperties;
}

/**
 * True when the desktop site is running inside the 3D scene's monitor iframe
 * rather than as the standalone site.
 */
const isEmbedded = (): boolean => {
    try {
        return window.self !== window.top;
    } catch (e) {
        // A cross-origin parent makes window.top unreadable. Only the 3D scene
        // ever embeds this site, so treat that case as embedded.
        return true;
    }
};

/**
 * Context-aware entry point to the 3D "enhanced experience", rendered in the
 * top nav. An animated box icon with a small tooltip:
 *  - Standalone, it sends the visitor into the 3D scene at /3d.
 *  - Embedded in the 3D scene's monitor, it leaves the scene and returns to the
 *    fast site on the current page.
 *
 * The icon draws itself in once on first load (after the page has loaded) and
 * again on hover; the tooltip auto-opens briefly on first load and on hover.
 */
const Enter3DButton: React.FC<Enter3DButtonProps> = ({ containerStyle }) => {
    const isMobile = useIsMobile();
    // `isEmbedded()` reads `window` and would default to "embedded" on the
    // server, mismatching the client — resolve it after mount.
    const [embedded, setEmbedded] = useState(false);
    const [tooltipOpen, setTooltipOpen] = useState(false);
    const boxRef = useRef<BoxIconHandle>(null);
    const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => setEmbedded(isEmbedded()), []);

    const openTooltipFor = useCallback((ms: number | null) => {
        setTooltipOpen(true);
        if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
        if (ms != null) {
            autoCloseRef.current = setTimeout(() => setTooltipOpen(false), ms);
        }
    }, []);

    // First-load flourish: once everything has loaded, draw the icon and flash
    // the tooltip so visitors notice the 3D option.
    useEffect(() => {
        if (isMobile) return;
        let cancelled = false;
        const run = () => {
            if (cancelled) return;
            // Let the nav settle in before the flourish.
            setTimeout(() => {
                if (cancelled) return;
                boxRef.current?.startAnimation();
                openTooltipFor(2800);
            }, 600);
        };
        if (document.readyState === 'complete') {
            run();
        } else {
            window.addEventListener('load', run, { once: true });
        }
        return () => {
            cancelled = true;
            window.removeEventListener('load', run);
            if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
        };
    }, [isMobile, openTooltipFor]);

    const handleEnter = useCallback(() => {
        boxRef.current?.startAnimation();
        if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
        setTooltipOpen(true);
    }, []);

    const handleLeave = useCallback(() => {
        boxRef.current?.stopAnimation();
        setTooltipOpen(false);
    }, []);

    const handleClick = useCallback(() => {
        if (embedded && window.top) {
            // Leave the 3D scene, keeping the visitor on their current page.
            window.top.location.href = window.location.pathname || '/';
        } else {
            window.location.href = '/3d';
        }
    }, [embedded]);

    // The 3D scene isn't offered on mobile, so neither is the entry button.
    if (isMobile) return null;

    const label = embedded ? 'Exit 3D mode' : 'Enter 3D mode';

    return (
        <div style={Object.assign({}, styles.wrapper, containerStyle)}>
            <button
                type="button"
                className="enter3d-btn"
                style={styles.button}
                aria-label={label}
                onClick={handleClick}
                onMouseEnter={handleEnter}
                onMouseLeave={handleLeave}
                onFocus={handleEnter}
                onBlur={handleLeave}
            >
                <BoxIcon ref={boxRef} size={26} />
            </button>

            <AnimatePresence>
                {tooltipOpen && (
                    <motion.div
                        style={styles.tooltip}
                        initial={{ opacity: 0, x: 6, y: '-50%', scale: 0.92 }}
                        animate={{ opacity: 1, x: 0, y: '-50%', scale: 1 }}
                        exit={{ opacity: 0, x: 6, y: '-50%', scale: 0.92 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        role="tooltip"
                    >
                        {label}
                        <span style={styles.tooltipArrow} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const styles: StyleSheetCSS = {
    wrapper: {
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    button: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 42,
        height: 42,
        padding: 0,
        cursor: 'pointer',
        color: 'var(--cfc-ink)',
    },
    tooltip: {
        position: 'absolute',
        top: '50%',
        right: 'calc(100% + 12px)',
        whiteSpace: 'nowrap',
        backgroundColor: 'var(--cfc-ink)',
        color: 'var(--cfc-paper)',
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        padding: '7px 11px',
        borderRadius: 6,
        boxShadow: '0 6px 20px rgba(19, 22, 20, 0.25)',
        pointerEvents: 'none',
        zIndex: 50,
    },
    // Sits on the tooltip's right edge, pointing toward the icon.
    tooltipArrow: {
        position: 'absolute',
        right: -4,
        top: '50%',
        marginTop: -4,
        width: 8,
        height: 8,
        backgroundColor: 'var(--cfc-ink)',
        transform: 'rotate(45deg)',
    },
};

export default Enter3DButton;
