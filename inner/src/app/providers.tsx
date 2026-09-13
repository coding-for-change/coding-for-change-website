'use client';
import React from 'react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { SiteConfigProvider } from '@/api/SiteConfigContext';
import { SiteFlagsProvider, type SiteFlags } from '@/api/SiteFlagsContext';
import AttributionTracker from './AttributionTracker';
import AnalyticsTracker from './AnalyticsTracker';
import ConsentManager from './ConsentManager';
import type { CmsSiteConfig } from '@/api/types';
import type { Locale } from '@/i18n/translations';

/**
 * Client context providers, seeded with values fetched on the server so the
 * first render (and the SSR HTML) already has the real site config and the
 * visitor's locale — the existing CMS hooks then refetch on locale change.
 */
export default function Providers({
    children,
    initialLocale,
    initialConfig,
    flags,
}: {
    children: React.ReactNode;
    initialLocale: Locale;
    initialConfig: CmsSiteConfig | null;
    flags: SiteFlags;
}) {
    return (
        <LanguageProvider initialLocale={initialLocale}>
            <SiteConfigProvider initialConfig={initialConfig}>
              <SiteFlagsProvider value={flags}>
                {/* ConsentManager first: the trackers subscribe to the consent
                    store it populates, and both hold their events until it
                    resolves. */}
                <ConsentManager />
                <AttributionTracker />
                <AnalyticsTracker />
                {children}
              </SiteFlagsProvider>
            </SiteConfigProvider>
        </LanguageProvider>
    );
}
