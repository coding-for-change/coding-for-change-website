'use client';
import React, { createContext, useContext } from 'react';
import { useCmsGlobal } from './useCms';
import { CmsSiteConfig } from './types';
import { resolveHomepageMode, type HomepageMode } from '../lib/homepageMode';

interface SiteConfigState {
    config: CmsSiteConfig | null;
    loading: boolean;
}

const SiteConfigContext = createContext<SiteConfigState>({
    config: null,
    loading: true,
});

export const useSiteConfig = (): CmsSiteConfig & { loading: boolean } => {
    const { config, loading } = useContext(SiteConfigContext);
    // Return safe defaults while loading so components don't crash
    return {
        clubName: config?.clubName ?? '',
        tagline: config?.tagline ?? '',
        description: config?.description ?? '',
        email: config?.email ?? '',
        socialLinks: config?.socialLinks ?? [],
        copyrightText: config?.copyrightText ?? '',
        windowTitle: config?.windowTitle ?? '',
        bookingUrl: config?.bookingUrl ?? '',
        memberCount: config?.memberCount ?? '',
        stats: config?.stats ?? [],
        homepageMode: resolveHomepageMode(config),
        loading,
    };
};

/** The "Homepage audience" switch (Site Configuration); 'partners' until loaded. */
export const useHomepageMode = (): HomepageMode =>
    resolveHomepageMode(useContext(SiteConfigContext).config);

export const useSiteConfigLoading = (): boolean => {
    return useContext(SiteConfigContext).loading;
};

export const SiteConfigProvider: React.FC<{
    children: React.ReactNode;
    initialConfig?: CmsSiteConfig | null;
}> = ({ children, initialConfig }) => {
    const { data, loading } = useCmsGlobal<CmsSiteConfig>('site-config', initialConfig);

    return (
        <SiteConfigContext.Provider value={{ config: data, loading }}>
            {children}
        </SiteConfigContext.Provider>
    );
};
