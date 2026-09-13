'use client';
import React, { createContext, useContext } from 'react';

/**
 * Site-wide switches that live in CMS globals other than site-config and that
 * the chrome (nav, footer) needs on the first render. Fetched on the server in
 * the root layout and seeded here, like the site config.
 */
export interface SiteFlags {
    /** The TechTour page is linked from the navigation and footer. */
    techTourListed: boolean;
}

const SiteFlagsContext = createContext<SiteFlags>({ techTourListed: false });

export const useSiteFlags = (): SiteFlags => useContext(SiteFlagsContext);

export const SiteFlagsProvider: React.FC<{ value: SiteFlags; children: React.ReactNode }> = ({
    value,
    children,
}) => <SiteFlagsContext.Provider value={value}>{children}</SiteFlagsContext.Provider>;
