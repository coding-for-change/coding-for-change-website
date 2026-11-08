import FaqPage from '@/components/showcase/FaqPage';
import { fetchCollection, fetchGlobal } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import type { CmsFaqItem, CmsHomepage } from '@/api/types';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Q&A — Coding for Change',
    description:
        'Answers for non-profits and for students: what a project costs, how long it takes, who maintains it, and how to join.',
};

export default async function QaPage() {
    const locale = await getServerLocale();
    const [faq, homepage] = await Promise.all([
        fetchCollection<CmsFaqItem>('faq', locale),
        fetchGlobal<CmsHomepage>('homepage', locale),
    ]);
    return <FaqPage faq={faq} homepage={homepage} />;
}
