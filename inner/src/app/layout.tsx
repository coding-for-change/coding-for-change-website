import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Geist, Geist_Mono } from 'next/font/google';
// All four global stylesheets — importing every one here is what the old CRA
// build did via index.tsx/App.tsx. (The abandoned migration dropped App.css and
// mobile.css, which is what broke its formatting.)
import '../vendor/klaro/klaro.min.css';
import '../consent.css';
import '../index.css';
import '../App.css';
import '../components/showcase/landing.css';
import '../components/mobile/mobile.css';

import Providers from './providers';
import InputRelay from './InputRelay';
import GoogleTag from '@/components/general/GoogleTag';
import { fetchGlobal } from '@/lib/cms';
import { techTourListed } from '@/lib/techTour';
import { getServerLocale } from '@/lib/locale';
import type { CmsSiteConfig, CmsTechTour } from '@/api/types';

// The TechTour's ASCII skyline is laid out on Roboto Mono's character cell
// (TechTourSkyline.tsx), so it keeps its own mono.
const robotoMono = localFont({
    src: '../assets/fonts/RobotoMono-latin.woff2',
    weight: '100 700',
    display: 'swap',
    variable: '--font-roboto-mono',
});

// Site typography: Geist for everything set in words, headings included, and
// Geist Mono as the second voice (labels, numbers), taken from the >_ wordmark.
// Both are variable fonts, so one file covers every weight. Next self-hosts
// them at build time: there is no runtime request to Google. The CSS reads
// them through --font-sans / --font-mono (index.css).
const geist = Geist({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-geist',
});
const geistMono = Geist_Mono({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-geist-mono',
});

export const metadata: Metadata = {
    metadataBase: new URL('https://codingforchange.com'),
    title: 'Coding for Change — TUM Student Initiative for Social Tech (Munich, Club)',
    description:
        'Coding for Change is a TUM student initiative and Munich-based Club. We build software for NGOs, host hackathons, and bring students together for social good. Join us in Munich.',
    manifest: '/manifest.json',
    icons: {
        icon: [
            { url: '/favicon.ico' },
            { url: '/images/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
            { url: '/images/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        ],
        apple: '/images/apple-touch-icon.png',
    },
    openGraph: {
        type: 'website',
        url: 'https://codingforchange.com/',
        title: 'Coding for Change — TUM Student Initiative',
        description:
            "Munich's leading social computer science initiative. Software for NGOs. TUM students welcome.",
        images: ['/images/android-chrome-512x512.png'],
        locale: 'en_US',
        alternateLocale: 'de_DE',
    },
    twitter: {
        card: 'summary',
        title: 'Coding for Change — TUM Student Initiative',
        description: "Munich's leading social computer science initiative.",
    },
};

export const viewport: Viewport = {
    themeColor: '#000000',
    width: 'device-width',
    initialScale: 1,
};

// Organization structured data (ported from the old index.html).
const ORG_JSONLD = {
    '@context': 'https://schema.org',
    '@type': ['NGO', 'EducationalOrganization'],
    name: 'Coding for Change',
    alternateName: 'Coding for Change e.V.',
    url: 'https://codingforchange.com',
    logo: 'https://codingforchange.com/images/android-chrome-512x512.png',
    description:
        'Munich-based, TUM-accredited student initiative and Club building software for NGOs.',
    foundingLocation: 'Munich, Germany',
    areaServed: 'DE',
    sameAs: [
        'https://www.linkedin.com/company/coding-for-change/',
        'https://github.com/coding-for-change',
    ],
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const locale = await getServerLocale();
    const [siteConfig, techTour] = await Promise.all([
        fetchGlobal<CmsSiteConfig>('site-config', locale),
        fetchGlobal<CmsTechTour>('tech-tour', locale),
    ]);

    return (
        <html
            lang={locale}
            className={`${robotoMono.variable} ${geist.variable} ${geistMono.variable}`}
        >
            <head>
                {/* `_parent` keeps links working when the OS is embedded in the
                    3D scene's monitor iframe. */}
                <base target="_parent" />
                {}
                <link rel="preconnect" href="https://use.typekit.net" />
                <link
                    rel="preconnect"
                    href="https://p.typekit.net"
                    crossOrigin="anonymous"
                />
                <script
                    dangerouslySetInnerHTML={{
                        __html:
                            "(function(){var l=document.createElement('link');" +
                            "l.rel='stylesheet';l.href='https://use.typekit.net/llo2eru.css';" +
                            "l.media='print';l.onload=function(){this.onload=null;this.media='all'};" +
                            'document.head.appendChild(l);})();',
                    }}
                />
                <noscript>
                    {/* eslint-disable-next-line @next/next/no-page-custom-font */}
                    <link rel="stylesheet" href="https://use.typekit.net/llo2eru.css" />
                </noscript>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
                />
                <GoogleTag />
            </head>
            <body>
                <noscript>
                    <h1>Coding for Change — Munich&apos;s Student Initiative for Social Tech</h1>
                    <p>
                        Coding for Change is a student initiative from TUM and LMU based in
                        Munich. We build software for NGOs, host hackathons, and bring students
                        together to use code for social good.
                    </p>
                    <nav>
                        <a href="/ngos">For NGOs</a> · <a href="/team">Team</a> ·{' '}
                        <a href="/projects">Projects</a> · <a href="/events">Events</a> ·{' '}
                        <a href="/partners">Partners</a> · <a href="/qa">FAQ</a> ·{' '}
                        <a href="/join">Join</a> · <a href="/contact">Contact</a>
                    </nav>
                </noscript>

                <InputRelay />
                <Providers
                    initialLocale={locale}
                    initialConfig={siteConfig}
                    flags={{
                        techTourListed: techTourListed(techTour),
                        serverNow: Date.now(),
                    }}
                >
                    {children}
                </Providers>
            </body>
        </html>
    );
}
