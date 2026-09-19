import TechTour from '@/components/showcase/TechTour';
import { fetchGlobal } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import type { Metadata } from 'next';
import type { CmsTechTour } from '@/api/types';
import { techTourIndexable } from '@/lib/techTour';

export const dynamic = 'force-dynamic';

/**
 * Search engines are kept out until the page is switched to "Public" in the
 * CMS (TechTour Page → Visibility): noindex, but follow, so link equity still
 * flows. The sitemap (outer server) applies the same rule.
 */
export async function generateMetadata(): Promise<Metadata> {
    const locale = await getServerLocale();
    const techTour = await fetchGlobal<CmsTechTour>('tech-tour', locale);
    return {
        title: 'Munich TechTour — Coding for Change',
        description:
            'One week, one company visit per evening: the Munich TechTour takes students inside the tech companies shaping Munich. Free, open to every student. Register now.',
        robots: techTourIndexable(techTour) ? undefined : { index: false, follow: true },
    };
}

export default async function TechTourPage() {
    const locale = await getServerLocale();
    const techTour = await fetchGlobal<CmsTechTour>('tech-tour', locale);
    return <TechTour techTour={techTour} serverNow={Date.now()} />;
}
