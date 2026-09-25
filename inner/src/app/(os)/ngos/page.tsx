import Partner from '@/components/showcase/Partner';
import { fetchGlobal } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import type { CmsPartner, CmsAbout, CmsHomepage } from '@/api/types';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Partner with us — Coding for Change',
    description:
        'Non-profits: we design and ship the software you need — free, delivered by a dedicated student team in a single semester. Start a conversation.',
};

export default async function NgosPage() {
    const locale = await getServerLocale();
    const [partner, about, homepage] = await Promise.all([
        fetchGlobal<CmsPartner>('partner', locale),
        fetchGlobal<CmsAbout>('about', locale),
        fetchGlobal<CmsHomepage>('homepage', locale),
    ]);
    return <Partner partner={partner} about={about} homepage={homepage} />;
}
