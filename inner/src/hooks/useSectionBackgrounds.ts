'use client';
import { useEffect, type RefObject } from 'react';

/**
 * Scroll-driven page background. Every descendant of `root` carrying a
 * `data-bg="#rrggbb"` attribute is a band; as the next band's top edge climbs
 * from 78% to 32% of the viewport, the root's background blends towards its
 * colour, and the nav is told whether it is over a dark or light background
 * (`html[data-nav]`, see landing.css). A band may narrow that window with
 * `data-bg-window="0.12 0.02"` (start and end as viewport fractions) — the
 * TechTour's white band does, so the nav ink flips only once the white has
 * actually reached the nav. Extracted from the Landing so the TechTour intro
 * can turn the page black and back the same way.
 *
 * A band can also set the nav's ink for as long as it sits under the nav,
 * whatever its own colour: `data-nav-over="dark"`. The homepage hero needs it –
 * a dark photo framed in paper. While such a band is under the nav,
 * `html[data-nav-photo]` is set too, so the nav drops its glass over the photo.
 *
 * On desktop the site scrolls inside `.site-scroll`, not the window; the hook
 * finds that scroller from the root. With prefers-reduced-motion nothing is
 * blended (the bands keep their own backgrounds), but the nav still follows
 * the band beneath it.
 */
export default function useSectionBackgrounds(root: RefObject<HTMLElement | null>): void {
    useEffect(() => {
        const el = root.current;
        if (!el) return;
        const blend = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const scroller = el.closest('.site-scroll') as HTMLElement | null;
        const listenTarget: HTMLElement | Window = scroller ?? window;
        const html = document.documentElement;
        const toRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        const isDark = ([r, g, b]: number[]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;

        let raf = 0;
        const paint = () => {
            raf = 0;
            const viewTop = scroller ? scroller.getBoundingClientRect().top : 0;
            const viewH = scroller ? scroller.clientHeight : window.innerHeight;

            const sections = Array.from(el.querySelectorAll<HTMLElement>('[data-bg]')).filter(
                (s) => s.offsetParent !== null
            );
            if (sections.length === 0) return;

            let [r, g, b] = toRgb(sections[0].dataset.bg!);
            for (const s of sections.slice(1)) {
                const [start, end] = (s.dataset.bgWindow ?? '0.78 0.32')
                    .split(/\s+/)
                    .map(Number);
                const topRatio = (s.getBoundingClientRect().top - viewTop) / viewH;
                const p = Math.min(1, Math.max(0, (start - topRatio) / (start - end)));
                if (p === 0) continue;
                const [r2, g2, b2] = toRgb(s.dataset.bg!);
                r += (r2 - r) * p;
                g += (g2 - g) * p;
                b += (b2 - b) * p;
            }
            if (blend) el.style.backgroundColor = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;

            // The band under the middle of the nav strip (64px tall).
            const navLine = viewTop + 32;
            const under = sections.find((s) => {
                const rect = s.getBoundingClientRect();
                return rect.top <= navLine && rect.bottom > navLine;
            });
            const over = under?.dataset.navOver;
            if (over) {
                html.dataset.nav = over;
                html.dataset.navPhoto = '';
            } else {
                delete html.dataset.navPhoto;
                const ground = blend || !under ? [r, g, b] : toRgb(under.dataset.bg!);
                html.dataset.nav = isDark(ground) ? 'dark' : 'light';
            }
        };
        const onScroll = () => {
            if (!raf) raf = requestAnimationFrame(paint);
        };
        paint();
        listenTarget.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        // Bands can appear or disappear without a scroll (the intro mounting).
        const observer = new MutationObserver(onScroll);
        observer.observe(el, { childList: true, subtree: true, attributeFilter: ['data-bg'] });
        return () => {
            listenTarget.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            observer.disconnect();
            if (raf) cancelAnimationFrame(raf);
            el.style.backgroundColor = '';
            delete html.dataset.nav;
            delete html.dataset.navPhoto;
        };
    }, [root]);
}
