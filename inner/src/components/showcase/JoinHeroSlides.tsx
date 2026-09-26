'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import './join.css';

/** How long each photo stays before the next one fades in. */
const SLIDE_MS = 30_000;

export interface HeroSlide {
    id: string;
    photo: string;
    alt: string;
    /** A casual line on what happened here ("here, we …"). */
    caption: string;
    /** Crop of the photo inside the 5:4 frame. */
    position?: string;
    /** The event's cover image, pinned to the photo's corner. */
    poster?: string;
    posterAlt?: string;
}

export interface JoinHeroSlidesProps {
    slides: HeroSlide[];
    /** Accessible name of the slideshow. */
    label: string;
    /** Label for the dot buttons; `{n}` is the photo number. */
    goTo: string;
    /** Drawn over the photo frame – the round's status chip. */
    children?: React.ReactNode;
}

/** A hand-drawn arrow curving up from the note to the photo above it. */
const NoteArrow: React.FC = () => (
    <svg className="jn-slides__arrow" viewBox="0 0 56 48" aria-hidden="true" focusable="false">
        <path
            d="M52 40 C 36 44, 18 40, 15 28 C 13 20, 16 12, 20 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
        <path
            d="M13 11 L 20 4 L 24 13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

/**
 * The photo in the /join head, as a slideshow: a photo from each kind of
 * event, a casual note with an arrow saying what happened there and – where
 * the event had one – its cover image pinned to the corner. It moves on by
 * itself every SLIDE_MS, pauses while the pointer or keyboard focus is on it
 * (the rest of the photo's time is kept), and the dots on the photo jump
 * straight to one. With reduced motion it stays put until a dot is pressed.
 */
const JoinHeroSlides: React.FC<JoinHeroSlidesProps> = ({ slides, label, goTo, children }) => {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const reduced = useReducedMotion();
    const count = slides.length;
    const auto = count > 1 && !reduced;

    // Time left on the current photo, so a pause resumes rather than restarts.
    const remaining = useRef(SLIDE_MS);
    const startedAt = useRef(0);
    useEffect(() => {
        remaining.current = SLIDE_MS;
    }, [index]);
    useEffect(() => {
        if (!auto || paused) return;
        startedAt.current = performance.now();
        const timer = window.setTimeout(
            () => setIndex((i) => (i + 1) % count),
            remaining.current
        );
        return () => {
            window.clearTimeout(timer);
            remaining.current -= performance.now() - startedAt.current;
        };
    }, [index, paused, auto, count]);

    const current = slides[index];

    return (
        <div
            className="jn-slides"
            role="region"
            aria-roledescription="carousel"
            aria-label={label}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
            }}
        >
            <div className="jn-slides__frame">
                {slides.map((slide, i) => (
                    <img
                        key={slide.id}
                        className="jn-slides__photo"
                        data-active={i === index}
                        src={slide.photo}
                        alt={i === index ? slide.alt : ''}
                        aria-hidden={i === index ? undefined : true}
                        style={slide.position ? { objectPosition: slide.position } : undefined}
                        fetchPriority={i === 0 ? 'high' : 'low'}
                        loading={i === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        draggable={false}
                    />
                ))}
                {/* The cover sits on its own white card: a border drawn on a
                    rotated <img> leaves a hairline of the photo showing
                    between frame and picture. */}
                {slides.map((slide, i) =>
                    slide.poster ? (
                        <span
                            key={`poster-${slide.id}`}
                            className="jn-slides__poster"
                            data-active={i === index}
                            aria-hidden={i === index ? undefined : true}
                        >
                            <img
                                src={slide.poster}
                                alt={i === index ? slide.posterAlt ?? '' : ''}
                                loading="lazy"
                                decoding="async"
                                draggable={false}
                            />
                        </span>
                    ) : null
                )}
                {count > 1 && (
                    <div className="jn-slides__dots">
                        {slides.map((slide, i) => (
                            <button
                                key={slide.id}
                                type="button"
                                className="jn-slides__dot"
                                aria-label={goTo.replace('{n}', String(i + 1))}
                                aria-current={i === index ? 'true' : undefined}
                                onClick={() => setIndex(i)}
                            >
                                <span className="jn-slides__pip" />
                            </button>
                        ))}
                    </div>
                )}
                {children}
            </div>
            <p className="jn-slides__note" aria-live={auto && !paused ? 'off' : 'polite'}>
                <NoteArrow />
                <span key={current.id} className="jn-slides__note-text">
                    {current.caption}
                </span>
            </p>
        </div>
    );
};

export default JoinHeroSlides;
