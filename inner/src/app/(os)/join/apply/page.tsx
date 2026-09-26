import JoinApply from '@/components/showcase/JoinApply';
import { fetchCollection, fetchGlobal } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import type { CmsForm, CmsMembership, CmsTechTour } from '@/api/types';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Apply – Join Coding for Change',
    description:
        'Apply to Coding for Change: a few lines on your motivation and your CV. Build software for non-profits with a student team.',
};

export default async function JoinApplyPage() {
    const locale = await getServerLocale();
    const [membership, forms, techTour] = await Promise.all([
        fetchGlobal<CmsMembership>('membership', locale),
        fetchCollection<CmsForm>('forms', locale),
        fetchGlobal<CmsTechTour>('tech-tour', locale),
    ]);
    return (
        <JoinApply
            membership={membership}
            forms={forms}
            techTour={techTour}
            serverNow={Date.now()}
        />
    );
}
