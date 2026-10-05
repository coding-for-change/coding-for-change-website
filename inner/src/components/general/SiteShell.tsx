'use client';
import React, { useEffect, useState } from 'react';
import TopNav from '@/components/showcase/TopNav';
import SiteFooter from '@/components/general/SiteFooter';
import ApplyBar from '@/components/general/ApplyBar';
import MobileLayout from '@/components/mobile/MobileLayout';
import useIsMobile from '@/hooks/useIsMobile';

/**
 * Persistent site chrome (top nav + footer) shared by every content route via
 * the `(os)` layout, and reused by the global `not-found` page so a 404 reads
 * like a normal page of the site rather than a bare screen.
 *
 * Desktop vs mobile chrome is a viewport decision only known on the client, so
 * we render the desktop shell on the server and during the first client render
 * (keeping content in the SSR HTML and avoiding a hydration mismatch), then swap
 * to the mobile chrome after mount if needed. The 3D scene embeds the site in a
 * ~1024px monitor iframe (right at the mobile breakpoint), whose sticky header
 * misbehaves inside the transformed iframe — the 3D experience is desktop-only,
 * so we stay on the desktop shell whenever embedded.
 */
export default function SiteShell({ children }: { children: React.ReactNode }) {
    const isMobile = useIsMobile();
    const [mounted, setMounted] = useState(false);
    const [embedded, setEmbedded] = useState(false);
    useEffect(() => {
        setMounted(true);
        try {
            setEmbedded(window.self !== window.top);
        } catch {
            setEmbedded(true);
        }
    }, []);

    if (mounted && isMobile && !embedded) {
        return (
            <div className="App">
                <MobileLayout>{children}</MobileLayout>
            </div>
        );
    }

    return (
        <div className="App">
            <div className="site-page">
                {/* Above everything, in flow: the nav and the scroller below
                    keep their own geometry inside .site-main. */}
                <ApplyBar />
                <div className="site-main">
                    <TopNav />
                    <div className="site-scroll">
                        {children}
                        <SiteFooter />
                    </div>
                </div>
            </div>
        </div>
    );
}
