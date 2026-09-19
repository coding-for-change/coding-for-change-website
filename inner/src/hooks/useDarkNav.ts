'use client';
import { useEffect } from 'react';

/**
 * Tell the nav it is sitting on a dark page.
 *
 * `html[data-nav='dark']` is the same switch the landing's scroll-driven
 * background painter throws (useSectionBackgrounds): the nav goes transparent
 * with a backdrop blur and its ink turns white. A page that is simply dark all
 * the way down — the TechTour — has nothing to blend between, so it stamps the
 * attribute directly instead of running a scroll painter for one colour. That
 * also means it keeps working with prefers-reduced-motion, where the painter
 * does nothing at all.
 */
export default function useDarkNav(): void {
    useEffect(() => {
        const previous = document.documentElement.dataset.nav;
        document.documentElement.dataset.nav = 'dark';
        return () => {
            if (previous === undefined) delete document.documentElement.dataset.nav;
            else document.documentElement.dataset.nav = previous;
        };
    }, []);
}
