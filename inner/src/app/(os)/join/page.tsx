import BecomeAMember from '@/components/showcase/BecomeAMember';
import { fetchCollection, fetchGlobal } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import type { CmsMembership, CmsProject, CmsSponsor, CmsTeamMember, CmsTechTour } from '@/api/types';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Join – Coding for Change',
    description:
        'Build software for non-profits, meet Munich’s tech companies and apply for the next round of Coding for Change.',
};

export default async function JoinPage() {
    const locale = await getServerLocale();
    // Projects and partners feed the logo band, the team the "want to know
    // more?" contacts; depth 1 populates their logos and photos.
    const [membership, projects, sponsors, techTour, team] = await Promise.all([
        fetchGlobal<CmsMembership>('membership', locale),
        fetchCollection<CmsProject>('projects', locale, { depth: '1' }),
        fetchCollection<CmsSponsor>('sponsors', locale, { depth: '1' }),
        fetchGlobal<CmsTechTour>('tech-tour', locale),
        fetchCollection<CmsTeamMember>('team', locale, { depth: '1' }),
    ]);
    return (
        <BecomeAMember
            membership={membership}
            projects={projects}
            sponsors={sponsors}
            techTour={techTour}
            team={team}
            serverNow={Date.now()}
        />
    );
}
