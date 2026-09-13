import BecomeAMember from '@/components/showcase/BecomeAMember';
import { fetchCollection, fetchGlobal } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import type { CmsMembership, CmsForm, CmsTechTour } from '@/api/types';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Join — Coding for Change',
    description: 'Become a member of Coding for Change.',
};

export default async function JoinPage() {
    const locale = await getServerLocale();
    const [membership, forms, techTour] = await Promise.all([
        fetchGlobal<CmsMembership>('membership', locale),
        fetchCollection<CmsForm>('forms', locale),
        fetchGlobal<CmsTechTour>('tech-tour', locale),
    ]);
    return (
        <BecomeAMember
            membership={membership}
            forms={forms}
            techTour={techTour}
            serverNow={Date.now()}
        />
    );
}
