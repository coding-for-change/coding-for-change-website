import SponsorsList from '@/components/showcase/SponsorsList';
import { fetchCollection } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import type { CmsSponsor } from '@/api/types';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Partners — Coding for Change',
    description: 'The supporters who make Coding for Change possible.',
};

export default async function PartnersPage() {
    const locale = await getServerLocale();
    const sponsors = await fetchCollection<CmsSponsor>('sponsors', locale, {
        depth: '1',
    });
    return <SponsorsList sponsors={sponsors} />;
}
