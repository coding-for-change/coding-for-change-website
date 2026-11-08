import Partner from '@/components/showcase/Partner';
import { fetchCollection, fetchGlobal } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import type { CmsPartner, CmsHomepage, CmsFaqItem, CmsProject } from '@/api/types';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Partner with us — Coding for Change',
    description:
        'Non-profits: we design and ship the software you need — free, delivered by a dedicated student team in a single semester. Start a conversation.',
};

export default async function NgosPage() {
    const locale = await getServerLocale();
    const [partner, homepage, faq, projects] = await Promise.all([
        fetchGlobal<CmsPartner>('partner', locale),
        fetchGlobal<CmsHomepage>('homepage', locale),
        // The NGO questions (category "Projects") and the general ones.
        fetchCollection<CmsFaqItem>('faq', locale),
        // The references: every project with its NGO and press.
        fetchCollection<CmsProject>('projects', locale, { depth: '1' }),
    ]);
    return <Partner partner={partner} homepage={homepage} faq={faq} projects={projects} />;
}
