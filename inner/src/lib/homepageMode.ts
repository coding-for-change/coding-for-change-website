import type { CmsSiteConfig } from '../api/types';

/**
 * Which audience the homepage speaks to — the "Homepage audience" switch on
 * the Site Configuration global.
 *
 * 'partners' is the regular, professional page (NGOs book a first talk).
 * 'students' is the application-phase page: it borrows the Join page's
 * look — round status, dated application timeline, benefits and tracks —
 * and sends every button straight to the application form. Flipped by hand
 * in the CMS when a round opens and closes; the round's own dates live in
 * `applicationPhase.ts`.
 *
 * Missing (older data, CMS down) counts as 'partners', the safe default.
 */
export type HomepageMode = 'partners' | 'students';

export const resolveHomepageMode = (
    config: Pick<CmsSiteConfig, 'homepageMode'> | null | undefined
): HomepageMode => (config?.homepageMode === 'students' ? 'students' : 'partners');
