import Team from '@/components/showcase/TeamGrid';
import { fetchCollection } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import type { CmsTeamMember } from '@/api/types';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Team — Coding for Change',
    description: 'Meet the students behind Coding for Change.',
};

export default async function TeamPage() {
    const locale = await getServerLocale();
    // depth=2 so each member's `companies` relationship is populated to full
    // docs (and the companies' logos resolved) for the logo strip. Sorted by
    // `_order` (the drag-and-drop position set in the CMS admin) so the page
    // follows the editor's order rather than newest-first.
    const team = await fetchCollection<CmsTeamMember>('team', locale, {
        depth: '2',
        sort: '_order',
    });
    return <Team team={team} />;
}
