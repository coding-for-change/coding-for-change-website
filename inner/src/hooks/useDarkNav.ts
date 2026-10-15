'use client';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * The page colours the site chrome can take on: `dark` for a page that is
 * dark from top to bottom (/techtour/apply), `paper` for one on the warm
 * off-white of the tour page (/techtour).
 */
export type PageTone = 'dark' | 'paper';

/**
 * How many mounted pages are asking for each tone. Counts rather than a flag
 * so a route change — where the next page mounts before the last one
 * unmounts — cannot leave the chrome in the wrong colours.
 */
const tonePages: Record<PageTone, number> = { dark: 0, paper: 0 };
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
};
const publish = () => listeners.forEach((fn) => fn());

/**
 * Tell the site chrome which colour of page it is sitting on.
 *
 * The nav reads it as `html[data-nav]` — the same switch the landing's
 * scroll-driven background painter throws (useSectionBackgrounds): the nav goes
 * transparent with a backdrop blur, and on `dark` its ink turns white. A page
 * that is one colour all the way down has nothing to blend between, so it
 * stamps the attribute directly instead of running a scroll painter for one
 * colour. That also means it keeps working with prefers-reduced-motion, where
 * the painter does nothing at all.
 *
 * The footer cannot use the attribute: it is styled inline, and no selector
 * beats that. It subscribes with `useChromeTone` instead.
 */
export function usePageTone(tone: PageTone): void {
    useEffect(() => {
        const previous = document.documentElement.dataset.nav;
        document.documentElement.dataset.nav = tone;
        tonePages[tone] += 1;
        publish();
        return () => {
            if (previous === undefined) delete document.documentElement.dataset.nav;
            else document.documentElement.dataset.nav = previous;
            tonePages[tone] -= 1;
            publish();
        };
    }, [tone]);
}

/** A page that is dark from top to bottom. */
export default function useDarkNav(): void {
    usePageTone('dark');
}

/**
 * The other end of `usePageTone`, for chrome the page renders inside but does
 * not own — the footer, which lives in the shell above every route.
 *
 * Null on the server and on the first client render, because the page has not
 * run its effect yet and a footer that disagreed with the HTML would be a
 * hydration mismatch. It flips on the same tick the nav does, and the footer is
 * a full screen below the fold on both TechTour pages, so nobody watches it
 * happen.
 */
export const useChromeTone = (): PageTone | null =>
    useSyncExternalStore(
        subscribe,
        () => (tonePages.dark > 0 ? 'dark' : tonePages.paper > 0 ? 'paper' : null),
        () => null
    );
