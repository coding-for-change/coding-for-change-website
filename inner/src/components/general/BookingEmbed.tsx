'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Cal, { getCalApi } from '@calcom/embed-react';
import { useSiteConfig } from '../../api';
import { trackEvent } from '../../lib/analytics';
import { trackAdsConversion } from '../../lib/googleAds';
import { useLanguage } from '../../contexts/LanguageContext';
import { useOverlay } from '../../hooks/useOverlay';

export interface BookingEmbedProps {
    height?: number;
    /**
     * `inline` parks the calendar in the page — right for a page whose job is
     * booking (/ngos, /contact).
     *
     * `compact` shows a button that opens the same calendar in an overlay. The
     * widget is ~900px tall, which is most of a screen; on a page that is about
     * something else (a case study, the homepage) it buries the content that was
     * meant to do the persuading.
     */
    variant?: 'inline' | 'compact';
}

const ENV_BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL?.trim() || '';


const toEmbeddable = (raw: string): string => {
    if (!/calendar\.google\.com\/.*appointments\/schedules\//.test(raw)) return raw;
    if (/[?&]gv=true\b/.test(raw)) return raw;
    return raw + (raw.includes('?') ? '&' : '?') + 'gv=true';
};


const toCalLink = (url: string): string | null => {
    const m = url.match(/^https?:\/\/(?:www\.)?cal\.com\/([^?#]+)/);
    return m ? m[1].replace(/\/$/, '') : null;
};

/**
 * The calendar in an overlay: a centred panel on a dimmed backdrop, dismissed by
 * Esc, the close button or a backdrop click. Portalled onto <body> because
 * `.site-page` is transformed and would otherwise become the containing block
 * (the same reason the gallery lightbox does it).
 */
const BookingOverlay: React.FC<{
    label: string;
    closeLabel: string;
    onClose: () => void;
    children: React.ReactNode;
}> = ({ label, closeLabel, onClose, children }) => {
    useOverlay(onClose);
    if (typeof document === 'undefined') return null;
    return createPortal(
        <div
            className="lp-modal"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={onClose}
        >
            <div className="lp-modal__panel" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    className="lp-modal__close"
                    aria-label={closeLabel}
                    onClick={onClose}
                >
                    ×
                </button>
                <div className="lp-modal__body">{children}</div>
            </div>
        </div>,
        document.body
    );
};

/**
 * Embeds the club's Cal.com booking page as an iframe.
 *
 * The URL comes from the CMS (Site Configuration → "Booking page URL"), or from
 * the NEXT_PUBLIC_BOOKING_URL env var as a fallback. A direct "open in new tab"
 * link is always shown so visitors can still book even if the provider declines
 * to be iframed. Falls back to an email prompt when no URL is configured at all.
 *
 * To get the URL: copy the Cal.com event link (cal.com/<user>/<event>).
 */
const BookingEmbed: React.FC<BookingEmbedProps> = ({
    height = 700,
    variant = 'inline',
}) => {
    const siteConfig = useSiteConfig();
    const { t } = useLanguage();
    const rawUrl = (siteConfig.bookingUrl?.trim() || ENV_BOOKING_URL) || '';
    const url = rawUrl ? toEmbeddable(rawUrl) : '';
    const calLink = url ? toCalLink(url) : null;

    const compact = variant === 'compact';
    const containerRef = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    const [open, setOpen] = useState(false);
    const close = useCallback(() => setOpen(false), []);

    // Compact: the widget mounts the moment the overlay opens, so `visible`
    // tracks intent rather than scroll depth.
    useEffect(() => {
        if (open) setVisible(true);
    }, [open]);

    // Inline: prefetch as it approaches the viewport, so it is ready on arrival.
    useEffect(() => {
        if (compact || visible || !url) return;
        const el = containerRef.current;
        if (!el) return;
        // No IntersectionObserver (very old browsers) → load immediately.
        if (typeof IntersectionObserver === 'undefined') {
            setVisible(true);
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            // Start loading a little before it enters the viewport.
            { rootMargin: '400px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [compact, visible, url]);

    // Funnel: the calendar was shown. Inline, that is an *impression* — almost
    // everyone who scrolls this far triggers it — so it is never used as an ad
    // conversion. Compact only mounts on a click, so `calcom_modal` really is
    // intent; the label keeps the two apart in the dashboard. `booking_completed`
    // below stays the conversion signal either way.
    const bookingTracked = useRef(false);
    useEffect(() => {
        if (visible && url && !bookingTracked.current) {
            bookingTracked.current = true;
            trackEvent('booking_started', {
                label: compact ? 'calcom_modal' : 'calcom',
            });
        }
    }, [compact, visible, url]);

    // A booking actually submitted. Cal's embed posts `bookingSuccessful` to the
    // parent frame, so no webhook or /thanks redirect is needed — but only on the
    // `<Cal>` path. When the configured URL isn't a cal.com link we fall back to
    // a plain cross-origin iframe (below), which emits nothing observable.
    //
    // Note it fires at submission, which for a host-confirmation event type is
    // before the meeting is confirmed. That's the right moment for an ad
    // conversion — the lead is captured — but it means Google's count can exceed
    // confirmed meetings.
    const bookedUids = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (!visible || !calLink) return;
        let cancelled = false;

        (async () => {
            const cal = await getCalApi();
            if (cancelled || !cal) return;
            cal('on', {
                action: 'bookingSuccessful',
                callback: (e: unknown) => {
                    // Dedupe: a re-render or a duplicated event must not double
                    // count. `uid` is Cal's booking identifier.
                    const detail = (e as { detail?: { data?: { uid?: string } } })?.detail;
                    const uid = detail?.data?.uid;
                    if (uid) {
                        if (bookedUids.current.has(uid)) return;
                        bookedUids.current.add(uid);
                    }
                    trackEvent('booking_completed', {
                        label: 'calcom',
                        meta: uid ? { uid } : undefined,
                    });
                    trackAdsConversion('booking');
                },
            });
        })().catch(() => {
            // Cal's embed API unavailable — we keep the impression event and lose
            // only the completion signal.
        });

        return () => {
            cancelled = true;
        };
    }, [visible, calLink]);

    if (!url) {
        return (
            <div className="lp-booking">
                <div className="lp-booking__fallback">
                    <span>{t.book.fallback}</span>
                    {siteConfig.email && (
                        <a className="lp-social" href={`mailto:${siteConfig.email}`}>
                            {siteConfig.email}
                        </a>
                    )}
                </div>
            </div>
        );
    }

    // A cal.com link gets the native embed (responsive, and it reports bookings
    // back to us); anything else falls back to a plain iframe at a fixed height.
    const widget = calLink ? (
        <Cal calLink={calLink} config={{ theme: 'light' }} style={{ width: '100%' }} />
    ) : (
        <div className="lp-booking__scale" style={{ height }}>
            <iframe
                className="lp-booking__frame"
                src={url}
                title={t.book.title}
                frameBorder={0}
                loading="lazy"
            />
        </div>
    );

    const newTabLink = (
        <a
            className="lp-booking__link"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
        >
            {t.book.openInNewTab} ↗
        </a>
    );

    if (compact) {
        return (
            <div className="lp-booking lp-booking--compact">
                <button
                    type="button"
                    className="lp-btn lp-btn--primary"
                    onClick={() => setOpen(true)}
                >
                    {t.book.pickTime} →
                </button>
                {newTabLink}
                {open && (
                    <BookingOverlay
                        label={t.book.title}
                        closeLabel={t.common.close}
                        onClose={close}
                    >
                        {widget}
                    </BookingOverlay>
                )}
            </div>
        );
    }

    return (
        <div className="lp-booking" ref={containerRef}>
            {visible ? (
                widget
            ) : (
                <div className="lp-booking__scale" style={{ height }} aria-hidden>
                    {!calLink && <div className="lp-booking__frame" />}
                </div>
            )}
            {newTabLink}
        </div>
    );
};

export default BookingEmbed;
