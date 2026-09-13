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
// The key is written out literally at each call site (not via a constant) so
// the consent scanner (scripts/consent-scan.mjs), which only matches literal
// keys, sees it and checks it against its allowlist.
export const hasSeenTechTourIntro = (): boolean => {
    try {
        return window.localStorage.getItem('cfc-techtour-intro') === '1';
    } catch {
        return false;
    }
};

export const markTechTourIntroSeen = (): void => {
    try {
        window.localStorage.setItem('cfc-techtour-intro', '1');
    } catch {
        /* storage unavailable — the visitor simply sees the intro again */
    }
};
