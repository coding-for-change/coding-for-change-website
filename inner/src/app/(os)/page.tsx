import type { Metadata } from 'next';
import Landing from '@/components/showcase/Landing';
import { fetchCollection, fetchGlobal } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import { resolveHomepageMode } from '@/lib/homepageMode';
import { translations } from '@/i18n/translations';
import type {
    CmsProject,
    CmsSponsor,
    CmsHomepage,
    CmsSiteConfig,
    CmsTeamMember,
    CmsTechTour,
} from '@/api/types';

export const dynamic = 'force-dynamic';

/**
 * In student mode (Site Configuration → Homepage audience) the homepage is
 * the application round's landing page, so its title and description say so;
 * otherwise the root layout's site-wide metadata stands.
 */
export async function generateMetadata(): Promise<Metadata> {
    const locale = await getServerLocale();
    const siteConfig = await fetchGlobal<CmsSiteConfig>('site-config', locale);
    if (resolveHomepageMode(siteConfig) !== 'students') return {};
    const s = translations[locale].studentHome;
    return { title: s.metaTitle, description: s.metaDescription };
}

export default async function HomePage() {
    const locale = await getServerLocale();
    const [projects, sponsors, homepage, team, techTour] = await Promise.all([
        fetchCollection<CmsProject>('projects', locale),
        fetchCollection<CmsSponsor>('sponsors', locale, { depth: '1' }),
        fetchGlobal<CmsHomepage>('homepage', locale),
        // The members named on the student-mode "ways in" cards; depth 1
        // populates their photos.
        fetchCollection<CmsTeamMember>('team', locale, { depth: '1' }),
        // The hosts of its evenings join the logo strip while the page is listed.
        fetchGlobal<CmsTechTour>('tech-tour', locale),
    ]);
    return (
        <Landing
            projects={projects}
            sponsors={sponsors}
            homepage={homepage}
            team={team}
            techTour={techTour}
        />
    );
}
