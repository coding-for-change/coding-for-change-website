'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

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
 *
 * The evening events' phone shots went soft in their darker parts at hero
 * size (2026-11-12), so a photo needs good light or a real camera to belong
 * here. With one photo the slideshow stands still.
 */
export const HERO_SLIDES: HeroSlide[] = [
    // The hackathon at Picus Capital (Drive: Hackathon @ Picus Capital,
    // IMG_0124) – the 2400 px file is also /partners' hackathon photo.
    bundled('hackathon-picus', '50% 60%'),
    // The Intro Day at the TUM Think Tank, 14 Nov 2026 (Canon, IMG_1513).
    // Its phone crop (x 1250 of 6000) has the standing man near the middle,
    // the player and the screen on his left.
    bundled('intro-day-think-tank', '50% 55%'),
    // A Tech Tour evening at QuantCo, 11 Nov 2026 (iPhone 16, IMG_4383). The
    // room was well lit, so unlike the earlier evening shots it holds up at
    // hero size. Its phone crop leaves out the top of the ceiling.
    bundled('techtour-evening-quantco', '50% 70%'),
];
/** How long each photo stays before the next fades in. */
const HOLD_MS = 7000;
/** The longest the lower images wait for the first photo (a crawler may never load it). */
const GATE_MS = 6000;

/**
 * Whether the page's lower images may load yet. The homepage holds them back
 * until its first hero photo is in: on a slow connection every image shares
 * the line, and logos and cards no one can see yet kept the photo – the first
 * thing everyone sees – waiting for seconds. Everywhere else it is true from
 * the start.
 */
export const AfterHero = createContext(true);
export const useAfterHero = () => useContext(AfterHero);
/** A clear pixel in place of an image that is still waiting. */
export const WAITING_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Which photo is showing, and how far the set has loaded – shared by the
 * photos and the caption beside the headline. The first photo comes with the
 * page; once it is in (`ready`), the lower images may load (AfterHero) and
 * the photos start to change. Each next photo is fetched one turn ahead, and
 * the set only moves on to a photo that is there. With reduced motion (or a
 * single photo) it stays put and fetches no others.
 */
export const useHeroSlideshow = (count: number) => {
    const [active, setActive] = useState(0);
    const [ready, setReady] = useState(false);
    // The highest photo fetched so far.
    const [upTo, setUpTo] = useState(0);
    const loaded = useRef(new Set<number>());
    const onLoad = useCallback((i: number) => {
        loaded.current.add(i);
        if (i === 0) setReady(true);
    }, []);
    useEffect(() => {
        const gate = window.setTimeout(() => setReady(true), GATE_MS);
        return () => window.clearTimeout(gate);
    }, []);
    useEffect(() => {
        if (!ready || count < 2) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        setUpTo((u) => Math.max(u, active + 1));
    }, [ready, count, active]);
    useEffect(() => {
        if (!ready || count < 2) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const tick = window.setInterval(() => {
            setActive((i) => {
                const next = (i + 1) % count;
                return loaded.current.has(next) ? next : i;
            });
        }, HOLD_MS);
        return () => window.clearInterval(tick);
    }, [ready, count]);
    return { active, ready, upTo, onLoad };
};

/**
 * The photos in the homepage hero frame: a slow crossfade through moments of
 * the club, each drifting in a little (landing.css, `.lp-hero__photo`).
 * Phones get the tall crop, wider screens the 2400 or 3200 px file. A CMS
 * upload (Homepage → Hero image) replaces the set with that one photo.
 */
const HeroPhotos: React.FC<{
    photo?: string | null;
    alt: string;
    active: number;
    upTo: number;
    onLoad: (i: number) => void;
}> = ({ photo, alt, active, upTo, onLoad }) => {
    const slides: HeroSlide[] = photo ? [{ src: photo, position: 'center 35%' }] : HERO_SLIDES;
    // The first photo can be in before the page's script runs; its load event
    // has then come and gone.
    const first = useRef<HTMLImageElement>(null);
    useEffect(() => {
        if (first.current?.complete) onLoad(0);
    }, [onLoad]);
    return (
        <>
            {slides.map((slide, i) => {
                if (i > upTo) return null;
                const img = (
                    <img
                        ref={i === 0 ? first : undefined}
                        className={'lp-hero__photo' + (i === active ? ' lp-hero__photo--active' : '')}
                        src={slide.src}
                        srcSet={slide.large ? `${slide.src} 2400w, ${slide.large} 3200w` : undefined}
                        sizes={
                            // The frame is a screen tall: on a narrow screen a 4:3 or
                            // 3:2 photo covers it by height, wider than the screen.
                            slide.large ? '(max-aspect-ratio: 3/2) 150vh, 100vw' : undefined
                        }
                        alt={i === 0 ? alt : ''}
                        aria-hidden={i === 0 ? undefined : true}
                        // The first photo is the first thing everyone sees: ahead of
                        // everything else the page loads.
                        fetchPriority={i === 0 ? 'high' : undefined}
                        onLoad={() => onLoad(i)}
                        onError={i === 0 ? () => onLoad(0) : undefined}
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
