'use client';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * How many mounted pages are asking for dark chrome. A count rather than a
 * flag so a route change — where the next page mounts before the last one
 * unmounts — cannot leave the chrome light on a dark page.
 */
let darkPages = 0;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
};
const publish = () => listeners.forEach((fn) => fn());

/**
 * Tell the site chrome it is sitting on a dark page.
 *
 * The nav reads it as `html[data-nav='dark']` — the same switch the landing's
 * scroll-driven background painter throws (useSectionBackgrounds): the nav goes
 * transparent with a backdrop blur and its ink turns white. A page that is
 * simply dark all the way down — the TechTour — has nothing to blend between,
 * so it stamps the attribute directly instead of running a scroll painter for
 * one colour. That also means it keeps working with prefers-reduced-motion,
 * where the painter does nothing at all.
 *
 * The footer cannot use the attribute: it is styled inline, and no selector
 * beats that. It subscribes with `useDarkChrome` instead.
 */
export default function useDarkNav(): void {
    useEffect(() => {
        const previous = document.documentElement.dataset.nav;
        document.documentElement.dataset.nav = 'dark';
        darkPages += 1;
        publish();
        return () => {
            if (previous === undefined) delete document.documentElement.dataset.nav;
            else document.documentElement.dataset.nav = previous;
            darkPages -= 1;
            publish();
        };
    }, []);
}

/**
 * The other end of `useDarkNav`, for chrome the page renders inside but does
 * not own — the footer, which lives in the shell above every route.
 *
 * False on the server and on the first client render, because the page has not
 * run its effect yet and a footer that disagreed with the HTML would be a
 * hydration mismatch. It flips on the same tick the nav does, and the footer is
 * a full screen below the fold on both TechTour pages, so nobody watches it
 * happen.
 */
export const useDarkChrome = (): boolean =>
    useSyncExternalStore(
        subscribe,
        () => darkPages > 0,
        () => false
    );
