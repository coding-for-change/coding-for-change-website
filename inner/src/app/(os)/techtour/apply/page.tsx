import TechTourApply from '@/components/showcase/TechTourApply';
import { fetchCollection, fetchGlobal } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import type { Metadata } from 'next';
import type { CmsTechTour, CmsForm } from '@/api/types';
import { techTourIndexable } from '@/lib/techTour';

export const dynamic = 'force-dynamic';

/**
 * The registration page behind /techtour's "Apply now". It follows the tour
 * page's visibility switch (TechTour Page → Visibility): while the tour is not
 * public there is nothing to send people to from a search result.
 */
export async function generateMetadata(): Promise<Metadata> {
    const locale = await getServerLocale();
    const techTour = await fetchGlobal<CmsTechTour>('tech-tour', locale);
    return {
        title: 'Apply — Munich TechTour — Coding for Change',
        description:
            'Register for the Munich TechTour: pick the evenings you want to join. Free, open to every student.',
        robots: techTourIndexable(techTour) ? undefined : { index: false, follow: true },
    };
}

export default async function TechTourApplyPage() {
    const locale = await getServerLocale();
    const [techTour, forms] = await Promise.all([
        fetchGlobal<CmsTechTour>('tech-tour', locale),
        fetchCollection<CmsForm>('forms', locale),
    ]);
    return <TechTourApply techTour={techTour} forms={forms} serverNow={Date.now()} />;
}
