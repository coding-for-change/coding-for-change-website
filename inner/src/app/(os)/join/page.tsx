import BecomeAMember from '@/components/showcase/BecomeAMember';
import { fetchCollection, fetchGlobal } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import type { CmsMembership, CmsForm } from '@/api/types';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Join — Coding for Change',
    description: 'Become a member of Coding for Change.',
};

export default async function JoinPage() {
    const locale = await getServerLocale();
    const [membership, forms] = await Promise.all([
        fetchGlobal<CmsMembership>('membership', locale),
        fetchCollection<CmsForm>('forms', locale),
    ]);
    return (
        <BecomeAMember
            membership={membership}
            forms={forms}
            serverNow={Date.now()}
        />
    );
}
