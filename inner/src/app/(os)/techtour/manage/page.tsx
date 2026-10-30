import TechTourManage from '@/components/showcase/TechTourManage';
import { fetchTechTourManage } from '@/lib/cms';
import { getServerLocale } from '@/lib/locale';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

/**
 * A registrant's own page, reached only through the link in our mail
 * (`?token=…`): the evenings they registered for, to give some up. Never
 * indexed, and no referrer leaves it – the token in the address is the whole
 * key. The Google tag stays off this page too (middleware.ts, GoogleTag.tsx).
 */
export const metadata: Metadata = {
    title: 'Your evenings – Munich Tech Tour – Coding for Change',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
};

export default async function TechTourManagePage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string | string[] }>;
}) {
    const { token: raw } = await searchParams;
    const token = typeof raw === 'string' ? raw.trim() : '';
    const locale = await getServerLocale();
    const view = token ? await fetchTechTourManage(token, locale) : null;
    return <TechTourManage token={token} initialView={view} initialLocale={locale} />;
}
