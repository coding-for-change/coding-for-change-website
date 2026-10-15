import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Bundles the server + minimal node_modules into `.next/standalone` so the
    // Docker runner image can `node server.js` without a full install.
    output: 'standalone',
    // The prod Docker build gates on the TypeScript type-check (good), but we
    // don't want lint warnings to fail the build.
    eslint: { ignoreDuringBuilds: true },
    async redirects() {
        return [
            // Renamed pages — keep old links, ads and search results landing.
            // Sponsors became Partners, and the NGO page moved off /partner so
            // it doesn't sit one letter away from /partners.
            { source: '/sponsors', destination: '/partners', permanent: true },
            { source: '/partner', destination: '/ngos', permanent: true },
            // A TechTour host's private link to the registrations for its
            // evening. The page is the CMS's (inner/cms/src/endpoints/share.ts,
            // under /api, which the outer server already sends there); this is
            // the shorter address the team copies from the admin.
            { source: '/share/:token', destination: '/api/share/:token', permanent: false },
        ];
    },
};

export default nextConfig;
