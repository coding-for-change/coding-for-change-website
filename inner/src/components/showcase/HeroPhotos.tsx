'use client';
import React, { useEffect, useState } from 'react';

type HeroSlide = {
    /** 2400 px wide – the default, and a CMS upload's only size. */
    src: string;
    /** 3200 px wide, for retina screens. */
    large?: string;
    /** A tall 1:2 crop at full height, round the point a phone should show. */
    phone?: string;
    /** The point the wide crop keeps in view. */
    position: string;
};

/** A bundled photo in its three files: public/images/hero/<name>[-3200|-phone].webp. */
const bundled = (name: string, position: string): HeroSlide => ({
    src: `/images/hero/${name}.webp`,
    large: `/images/hero/${name}-3200.webp`,
    phone: `/images/hero/${name}-phone.webp`,
    position,
});

/**
 * The bundled hero photos (Drive → Marketing → Photos), each with the point
 * the wide crop keeps in view. Their captions are `landing.photoCaptions`, in
 * the same order. Only wide, sharp shots of people at work belong here, each
 * from a different event – no close-ups, no posed group photos, nothing
 * brightened. Each is exported from its original with light edge sharpening,
 * 2400 and 3200 px wide, plus a full-height crop for phones: the tall phone
 * frame would otherwise blow a landscape photo up 1.4–1.8×. A clip from
 * partner footage can replace them once its use is cleared.
 */
export const HERO_SLIDES: HeroSlide[] = [
    // The hackathon at Picus Capital (Drive: Hackathon @ Picus Capital,
    // IMG_0124) – the 2400 px file is also /partners' hackathon photo.
    bundled('hackathon-picus', '50% 60%'),
    // The Mario Kart tournament at CHECK24 (Drive: Mario Kart Tournament @
    // CHECK24, DSC04703 – also /join's community photo).
    bundled('mario-kart-check24', '50% 40%'),
    // The QuantCo company event (Drive: Poker Night @ QuantCo, IMG_3903).
    bundled('company-event-quantco', '50% 55%'),
    // The Tech Tour evening at Project A (2026-11-09) – a 4K frame from the
    // video, IMG_4189.MOV at 36.9 s.
    bundled('techtour-project-a', '35% 50%'),
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
 * the club, each drifting in a little (landing.css, `.lp-hero__photo`).
 * Phones get the tall crop, wider screens the 2400 or 3200 px file. A CMS
 * upload (Homepage → Hero image) replaces the set with that one photo.
 */
const HeroPhotos: React.FC<{ photo?: string | null; alt: string; active: number; loadRest: boolean }> = ({
    photo,
    alt,
    active,
    loadRest,
}) => {
    const slides: HeroSlide[] = photo ? [{ src: photo, position: 'center 35%' }] : HERO_SLIDES;
    return (
        <>
            {slides.map((slide, i) => {
                if (i > 0 && !loadRest) return null;
                const img = (
                    <img
                        className={'lp-hero__photo' + (i === active ? ' lp-hero__photo--active' : '')}
                        src={slide.src}
                        srcSet={slide.large ? `${slide.src} 2400w, ${slide.large} 3200w` : undefined}
                        sizes={slide.large ? '100vw' : undefined}
                        alt={i === 0 ? alt : ''}
                        aria-hidden={i === 0 ? undefined : true}
                        style={
                            {
                                '--hero-pos': slide.position,
                                // The phone file is already cropped round its point.
                                '--hero-pos-mobile': slide.phone ? 'center' : slide.position,
                            } as React.CSSProperties
                        }
                        draggable={false}
                    />
                );
                return slide.phone ? (
                    <picture key={slide.src}>
                        <source media="(max-width: 760px)" srcSet={slide.phone} />
                        {img}
                    </picture>
                ) : (
                    <React.Fragment key={slide.src}>{img}</React.Fragment>
                );
            })}
        </>
    );
};

export default HeroPhotos;
