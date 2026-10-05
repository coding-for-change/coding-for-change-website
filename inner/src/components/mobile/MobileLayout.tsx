'use client';
import React from 'react';
import MobileNav from './MobileNav';
import SiteFooter from '../general/SiteFooter';
import ApplyBar from '../general/ApplyBar';

// Height of the sticky nav bar — used to size the content area so that
// position:absolute pages fill the visible viewport below the nav.
const NAV_HEIGHT = 60;

// Mobile chrome wrapper. The active route's content is passed as `children`
// by the (os) layout; routing itself is handled by the Next.js App Router.
const MobileLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    return (
        <div style={styles.layout}>
            <ApplyBar variant="mobile" />
            <MobileNav />
            <div style={styles.content}>{children}</div>
            <SiteFooter />
        </div>
    );
};

const styles: StyleSheetCSS = {
    layout: {
        flex: 1,
        width: '100%',
        minHeight: '100vh',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
    },
    // Positioned wrapper so that position:absolute pages fill the visible
    // screen below the nav, while normal-flow pages push this container
    // taller and naturally scroll.
    content: {
        position: 'relative',
        flex: 1,
        minHeight: `calc(100vh - ${NAV_HEIGHT}px)`,
    },
};

export default MobileLayout;
