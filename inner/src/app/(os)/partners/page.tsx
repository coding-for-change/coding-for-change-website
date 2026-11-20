import SponsorsList from '@/components/showcase/SponsorsList';
import { fetchCollection, fetchGlobal } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import type { CmsSponsor, CmsTeamMember, CmsProject, CmsTechTour } from '@/api/types';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Partners — Coding for Change',
    description:
        'For companies: meet students from TUM, LMU and HM who build software for non-profits – at company events, community events and hackathons.',
};

export default async function PartnersPage() {
    const locale = await getServerLocale();
    const [sponsors, team, projects, techTour] = await Promise.all([
        fetchCollection<CmsSponsor>('sponsors', locale, { depth: '1' }),
        // depth=2 resolves each member's companies and their logos (the strip,
        // and the logos of past event hosts).
        fetchCollection<CmsTeamMember>('team', locale, { depth: '2', sort: '_order' }),
        // The press entries for the trust row.
        fetchCollection<CmsProject>('projects', locale, { depth: '1' }),
        // The TechTour evenings' hosts and their logos.
        fetchGlobal<CmsTechTour>('tech-tour', locale),
    ]);
    return <SponsorsList sponsors={sponsors} team={team} projects={projects} techTour={techTour} />;
}
