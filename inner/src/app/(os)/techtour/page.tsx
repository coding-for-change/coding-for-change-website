import TechTour from '@/components/showcase/TechTour';
import { fetchCollection, fetchGlobal } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import type { CmsTechTour, CmsForm } from '@/api/types';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Munich TechTour — Coding for Change',
    description:
        'One week, one company visit per evening: the Munich TechTour takes students inside the tech companies shaping Munich. Free, open to every student. Register now.',
};

export default async function TechTourPage() {
    const locale = await getServerLocale();
    const [techTour, forms] = await Promise.all([
        fetchGlobal<CmsTechTour>('tech-tour', locale),
        fetchCollection<CmsForm>('forms', locale),
    ]);
    return <TechTour techTour={techTour} forms={forms} serverNow={Date.now()} />;
}
