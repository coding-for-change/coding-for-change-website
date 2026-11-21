'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';

export type TypedPart = { text: string; className?: string };

/** The pause before the first key, while the copy fades in (ms). */
const START_MS = 450;
/** How long the cursor waits at the slip (one blink) before it deletes. */
const NOTICE_MS = 800;
/** And the breath before it types the right words. */
const RETYPE_MS = 180;

/** One state of the headline: how much of it is typed, the slip after that. */
type Frame = { at: number; typed: number; slip: string; busy: boolean };

/**
 * The whole performance as a list of frames: the headline typed up to where
 * `slip` leaves it, the slip typed on, a pause, the slip deleted, the rest of
 * the headline typed. A key every 24–54 ms, a short beat at each space and a
 * longer one where the next part (the grey half) begins. Seeded, so the
 * rhythm is the same on every visit. `settle` is the frame from which the
 * headline only goes on to its final words.
 */
const perform = (texts: string[], slipText: string): { frames: Frame[]; settle: number } => {
    const full = texts.join(' ');
    const joins = new Set<number>();
    texts.slice(0, -1).reduce((end, text) => {
        joins.add(end + text.length);
        return end + text.length + 1;
    }, 0);

    let seed = 11;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const key = (char: string, index: number) =>
        24 + random() * 30 + (char === ' ' ? (joins.has(index) ? 160 : 35) : 0);

    const frames: Frame[] = [{ at: 0, typed: 0, slip: '', busy: false }];
    let t = START_MS;
    const push = (typed: number, slip: string, busy = true) =>
        frames.push({ at: Math.round(t), typed, slip, busy });

    // The slip parts from the headline where the two first differ.
    let from = 0;
    while (slipText && from < full.length && full[from] === slipText[from]) from++;
    const slip = slipText ? slipText.slice(from) : '';
    const goTo = slip ? from : full.length;

    for (let i = 0; i < goTo; i++) {
        t += key(full[i], i);
        push(i + 1, '');
    }
    let settle = 0;
    if (slip) {
        for (let i = 0; i < slip.length; i++) {
            t += key(slip[i], -1);
            push(from, slip.slice(0, i + 1));
        }
        push(from, slip, false);
        t += NOTICE_MS;
        for (let i = slip.length - 1; i >= 0; i--) {
            t += i === slip.length - 1 ? 140 : 45;
            push(from, slip.slice(0, i));
        }
        push(from, '', false);
        settle = frames.length - 1;
        t += RETYPE_MS;
        for (let i = from; i < full.length; i++) {
            t += key(full[i], i);
            push(i + 1, '');
        }
    }
    push(full.length, '', false);
    if (!slip) settle = frames.length - 1;
    return { frames, settle };
};

/**
 * A headline typed out letter by letter, the block cursor (.lp-cursor) running
 * ahead of the text and blinking once it is done. With `slip` (the headline
 * as it is first mistyped, e.g. "Helping NGOs escape Excel.") it types that,
 * stops, deletes back to where the two differ and types the real words.
 *
 * Every letter of the headline is in the page from the start – the untyped
 * ones only hidden – so the lines are set once and nothing moves; the slip
 * takes no room and is drawn over the hidden letters. Search engines and
 * screen readers (via aria-label) get the headline itself, never the slip.
 * With reduced motion it is simply there. `onSettle` fires when the slip is
 * gone (or, without one, when the last letter is in).
 */
const TypedTitle: React.FC<{
    parts: TypedPart[];
    slip?: string;
    className?: string;
    onSettle?: () => void;
}> = ({ parts, slip = '', className, onSettle }) => {
    const texts = parts.map((part) => part.text.trim());
    const full = texts.join(' ');
    const key = texts.join('\u0000') + '\u0001' + slip;
    const { frames, settle } = useMemo(() => {
        const [head, slipText] = key.split('\u0001');
        return perform(head.split('\u0000'), slipText);
    }, [key]);

    const [frame, setFrame] = useState(0);
    // Where the lines break, measured before the first key (the words that
    // start a line). While it types, the lines are held there with <br>s:
    // `text-wrap: balance` can pick other breaks while the cursor moves
    // through the text, and a word would jump between lines.
    const [lineStarts, setLineStarts] = useState<number[] | null>(null);
    const ref = useRef<HTMLHeadingElement>(null);
    const onSettleRef = useRef(onSettle);
    onSettleRef.current = onSettle;

    useEffect(() => {
        setFrame(0);
        setLineStarts(null);
        const last = frames.length - 1;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setFrame(last);
            onSettleRef.current?.();
            return;
        }
        let raf = 0;
        let cancelled = false;
        // Measured once the web font is in, so the lines are the final ones.
        (document.fonts?.ready ?? Promise.resolve()).then(() => {
            if (cancelled || !ref.current) return;
            // A word starts a line where it begins left of the word before.
            // (Not by height: a word in the pixel face sits a few pixels
            // lower in its line than one in Geist.)
            const starts: number[] = [];
            let prevLeft = Infinity;
            ref.current.querySelectorAll<HTMLElement>('.lp-type__word').forEach((word) => {
                const left = word.getBoundingClientRect().left;
                if (left < prevLeft - 1 && prevLeft !== Infinity) starts.push(Number(word.dataset.start));
                prevLeft = left;
            });
            setLineStarts(starts);
            // Timed by animation frames, so a page opened in a background tab
            // starts typing when it is first looked at, not half-way through.
            let start = -1;
            let shown = 0;
            const tick = (now: number) => {
                if (start < 0) start = now;
                let next = shown;
                while (next < last && now - start >= frames[next + 1].at) next++;
                if (next !== shown) {
                    if (shown < settle && next >= settle) onSettleRef.current?.();
                    shown = next;
                    setFrame(next);
                }
                if (next < last) raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
        });
        return () => {
            cancelled = true;
            cancelAnimationFrame(raf);
        };
    }, [frames, settle]);

    const last = frames.length - 1;
    const held = frame < last && lineStarts ? new Set(lineStarts) : null;
    const { typed, slip: shownSlip, busy } = frames[Math.min(frame, last)];
    const cursor = <span className={'lp-cursor' + (busy ? ' lp-cursor--busy' : '')} />;
    // Word by word, each split where the typing has got to. The cursor (and
    // the slip, if one is showing) sits in the word that holds that point,
    // which never wraps round it.
    let index = 0;
    // A held line that starts with a part gets its <br> before the part's
    // span, not inside it: inside, the break would take the part's face (the
    // pixel one) and make the line above a pixel taller than it is.
    let partStart = -1;
    const word = (text: string) => {
        const start = index;
        index += text.length;
        const shownChars = Math.max(0, Math.min(text.length, typed - start));
        const cursorHere = typed >= start && typed <= start + text.length;
        return (
            <React.Fragment key={start}>
            {held?.has(start) && start !== partStart && <br />}
            <span data-start={start} className={'lp-type__word' + (cursorHere ? ' lp-type__word--cursor' : '')}>
                {text.slice(0, shownChars)}
                {cursorHere &&
                    (shownSlip ? (
                        <span className="lp-type__slip">
                            {shownSlip}
                            {cursor}
                        </span>
                    ) : (
                        cursor
                    ))}
                {shownChars < text.length && <span className="lp-type__rest">{text.slice(shownChars)}</span>}
            </span>
            </React.Fragment>
        );
    };

    return (
        <h1
            ref={ref}
            className={'lp-type' + (held ? ' lp-type--held' : '') + (className ? ` ${className}` : '')}
            aria-label={full}
        >
            <span aria-hidden="true">
                {parts.map((part, p) => {
                    if (p > 0) index += 1; // the joining space
                    partStart = part.className ? index : -1;
                    const breakFirst = partStart >= 0 && held?.has(partStart);
                    const tokens = texts[p]
                        .split(/(\s+)/)
                        .filter(Boolean)
                        .map((token) => {
                            if (/^\s+$/.test(token)) {
                                index += token.length;
                                return token;
                            }
                            return word(token);
                        });
                    return (
                        <React.Fragment key={p}>
                            {p > 0 && ' '}
                            {breakFirst && <br />}
                            {part.className ? <span className={part.className}>{tokens}</span> : tokens}
                        </React.Fragment>
                    );
                })}
            </span>
        </h1>
    );
};

export default TypedTitle;
