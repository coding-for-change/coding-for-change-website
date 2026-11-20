import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import Onboarding from '@/components/showcase/Onboarding';
import { SESSION_COOKIE, fetchOnboardingMe } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

/**
 * A new member's own page after the board admitted them: the onboarding
 * form, their to-dos and the documents to sign. Behind Google sign-in (the
 * CMS's session cookie, `payload-token`): read on the server for this
 * visitor's cookie alone and never cached, so nothing about one member can
 * reach another. Never indexed, kept out of the sitemap, and the Google tag
 * stays off it (lib/privatePages.ts).
 */
export const metadata: Metadata = {
    title: 'Onboarding – Coding for Change',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
};

export default async function OnboardingPage() {
    const locale = await getServerLocale();
    const token = (await cookies()).get(SESSION_COOKIE)?.value ?? '';
    const result = token ? await fetchOnboardingMe(token, locale) : 'signed-out';
    return (
        <Onboarding
            initialView={typeof result === 'object' ? result : null}
            signedOut={result === 'signed-out'}
            initialLocale={locale}
        />
    );
}
