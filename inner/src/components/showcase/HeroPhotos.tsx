'use client';
import React, { useEffect, useState } from 'react';

/**
 * The bundled hero photos (Drive → Marketing → Photos), each with the point
 * the crop keeps in view – on the wide frame and on the tall phone frame.
 * Their captions are `landing.photoCaptions`, in the same order. Only wide,
 * sharp shots of people at work belong here – no close-ups, no group photos.
 * A clip from partner footage can replace them once its use is cleared.
 */
export const HERO_SLIDES = [
    { src: '/images/hero/hackathon-picus.webp', position: '64% 70%', mobile: '84% 62%' },
    { src: '/images/hero/hackathon-laptops.webp', position: '50% 62%', mobile: '46% 60%' },
];
/** How long each photo stays before the next fades in. */
const HOLD_MS = 7000;

/**
 * Which photo is showing, advanced every few seconds – shared by the photos
 * and the caption beside the headline. The others are only fetched once the
 * first is on screen. With reduced motion (or a single photo) it stays put.
 */
export const useHeroSlideshow = (count: number) => {
    const [active, setActive] = useState(0);
    const [loadRest, setLoadRest] = useState(false);
    useEffect(() => {
        if (count < 2) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const preload = window.setTimeout(() => setLoadRest(true), 1200);
        const tick = window.setInterval(() => setActive((i) => (i + 1) % count), HOLD_MS);
        return () => {
            window.clearTimeout(preload);
            window.clearInterval(tick);
        };
    }, [count]);
    return { active, loadRest };
};

/**
 * The photos in the homepage hero frame: a slow crossfade through moments of
 * the club, each drifting in a little (landing.css, `.lp-hero__photo`). A CMS
 * upload (Homepage → Hero image) replaces the set with that one photo.
 */
const HeroPhotos: React.FC<{ photo?: string | null; alt: string; active: number; loadRest: boolean }> = ({
    photo,
    alt,
    active,
    loadRest,
}) => {
    const slides = photo ? [{ src: photo, position: 'center 35%', mobile: 'center 35%' }] : HERO_SLIDES;
    return (
        <>
            {slides.map((slide, i) =>
                i === 0 || loadRest ? (
                    <img
                        key={slide.src}
                        className={'lp-hero__photo' + (i === active ? ' lp-hero__photo--active' : '')}
                        src={slide.src}
                        alt={i === 0 ? alt : ''}
                        aria-hidden={i === 0 ? undefined : true}
                        style={
                            {
                                '--hero-pos': slide.position,
                                '--hero-pos-mobile': slide.mobile,
                            } as React.CSSProperties
                        }
                        draggable={false}
                    />
                ) : null
            )}
        </>
    );
};

export default HeroPhotos;
