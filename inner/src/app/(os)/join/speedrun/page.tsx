import JoinSpeedrun from '@/components/showcase/JoinSpeedrun';
import { fetchCollection, fetchGlobal } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import type { CmsForm, CmsMembership } from '@/api/types';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Speedrun your application – Join Coding for Change',
    description:
        'The short application to Coding for Change: a few questions, no CV, about two minutes. Build software for non-profits with a student team.',
};

export default async function JoinSpeedrunPage() {
    const locale = await getServerLocale();
    const [membership, forms] = await Promise.all([
        fetchGlobal<CmsMembership>('membership', locale),
        fetchCollection<CmsForm>('forms', locale),
    ]);
    return <JoinSpeedrun membership={membership} forms={forms} serverNow={Date.now()} />;
}
