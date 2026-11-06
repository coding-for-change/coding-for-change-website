'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackCtaClick, trackLanding, trackPageview } from '@/lib/analytics';

/**
 * Fires the session `landing` event once on entry, then a `pageview` on every
 * client-side route change. Renders nothing. Mounted in Providers, just after
 * AttributionTracker so the visit's attribution is captured first.
 *
 * Also records `cta_click` for any element marked `data-cta="<label>"` – one
 * delegated listener instead of an onClick per button. The event's `path` is
 * the page the click happened on, so one label (e.g. `nav-join`) can be
 * compared across pages. Capture phase, so it still fires when a handler
 * further down stops propagation; it runs before Next.js navigates, so the
 * click lands ahead of the next page's `pageview`.
 */
export default function AnalyticsTracker() {
  const pathname = usePathname();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      trackLanding(); // covers the entry page; won't double-count as pageview
      return;
    }
    trackPageview(pathname ?? undefined);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-cta]');
      const label = el?.getAttribute('data-cta');
      if (label) trackCtaClick(label);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
