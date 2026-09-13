/**
 * "Has this visitor already watched the TechTour intro?" — one localStorage
 * flag so returning visitors land on the plain page (with a replay button)
 * instead of the black constellation every time.
 *
 * Declared in the consent config as first-party functional storage
 * (klaroConfig.ts, the "necessary" service): no tracking, no identifier, just
 * a yes/no about a UI state, which is § 25(2) exempt. Every access is wrapped
 * because storage can be blocked or throw (private windows, cleared data).
 */
export const TECHTOUR_INTRO_KEY = 'cfc-techtour-intro';

export const hasSeenTechTourIntro = (): boolean => {
    try {
        return window.localStorage.getItem(TECHTOUR_INTRO_KEY) === '1';
    } catch {
        return false;
    }
};

export const markTechTourIntroSeen = (): void => {
    try {
        window.localStorage.setItem(TECHTOUR_INTRO_KEY, '1');
    } catch {
        /* storage unavailable — the visitor simply sees the intro again */
    }
};
