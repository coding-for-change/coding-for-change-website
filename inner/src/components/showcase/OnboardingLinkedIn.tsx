'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * The optional LinkedIn step on /onboarding: a "new joiner" picture for a
 * post, made from the association's template with the member's photo, name
 * and two lines of their own in it, and the profile banner to download.
 *
 * The picture is drawn in the browser on a canvas and downloaded from there:
 * nothing is sent anywhere, and a photo picked here from the device is not
 * uploaded. It starts with the photo from the form when there is one.
 *
 * The template is the designed post with the name and role lines left empty
 * (public/images/onboarding/linkedin-post-template.png, 1080 x 1351); the
 * numbers below are where its photo frame and text lines sit.
 */
const TEMPLATE = '/images/onboarding/linkedin-post-template.png';
const BANNER = '/images/onboarding/linkedin-banner.jpeg';

const FRAME = { x: 82, y: 183, w: 916, h: 594, r: 38 };
const TEXT_X = 82;
const NAME = { baseline: 1198, size: 45, weight: 600, color: '#1a1a1a' };
const LINES = [
    { baseline: 1243, color: '#1a1a1a' },
    { baseline: 1276, color: '#5a5a5a' },
];
const LINE_SIZE = 24;
const TEXT_MAX = 700;
/** Portraits are cut from near the top, where the face is. */
const CROP_FROM_TOP = 0.28;

const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('image'));
        img.src = src;
    });

export interface OnboardingLinkedInProps {
    /** As on their account; they can change it for the picture. */
    name: string;
    /** The photo from their form, readable with their session; null when there is none. */
    photoUrl: string | null;
}

const OnboardingLinkedIn: React.FC<OnboardingLinkedInProps> = ({ name: initialName, photoUrl }) => {
    const { t } = useLanguage();
    const o = t.onboarding;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [template, setTemplate] = useState<HTMLImageElement | null>(null);
    const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
    const [name, setName] = useState(initialName);
    const [line1, setLine1] = useState(o.liLine1Default);
    const [line2, setLine2] = useState('');
    const [failed, setFailed] = useState(false);
    const [fontsReady, setFontsReady] = useState(false);
    const ownUrl = useRef<string | null>(null);

    useEffect(() => {
        let live = true;
        loadImage(TEMPLATE)
            .then((img) => live && setTemplate(img))
            .catch(() => live && setFailed(true));
        return () => {
            live = false;
        };
    }, []);

    useEffect(() => {
        if (!photoUrl) return;
        let live = true;
        loadImage(photoUrl)
            .then((img) => live && !ownUrl.current && setPhoto(img))
            .catch(() => undefined);
        return () => {
            live = false;
        };
    }, [photoUrl]);

    useEffect(
        () => () => {
            if (ownUrl.current) URL.revokeObjectURL(ownUrl.current);
        },
        []
    );

    // The wordmark's typeface, as the site loads it (next/font gives it a
    // generated family name, so it is read from the variable).
    const monoFamily = () => {
        const canvas = canvasRef.current;
        const fromSite = canvas ? getComputedStyle(canvas).getPropertyValue('--font-roboto-mono').trim() : '';
        return `${fromSite ? `${fromSite}, ` : ''}'Roboto Mono', ui-monospace, Menlo, monospace`;
    };

    useEffect(() => {
        const family = monoFamily();
        const fonts = typeof document !== 'undefined' ? document.fonts : null;
        if (!fonts) {
            setFontsReady(true);
            return;
        }
        Promise.all([fonts.load(`${NAME.weight} ${NAME.size}px ${family}`), fonts.load(`400 ${LINE_SIZE}px ${family}`)])
            .catch(() => undefined)
            .then(() => setFontsReady(true));
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !template) return;
        canvas.width = template.naturalWidth;
        canvas.height = template.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(template, 0, 0);

        if (photo) {
            const { x, y, w, h, r } = FRAME;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
            ctx.clip();
            // Cover the frame: scale to fill, cut the rest.
            const scale = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
            const dw = photo.naturalWidth * scale;
            const dh = photo.naturalHeight * scale;
            ctx.drawImage(photo, x + (w - dw) / 2, y + (h - dh) * CROP_FROM_TOP, dw, dh);
            ctx.restore();
        }

        const family = monoFamily();
        ctx.textBaseline = 'alphabetic';
        // A long name or line is set smaller rather than run into the mark.
        const write = (text: string, size: number, weight: number, color: string, baseline: number) => {
            const value = text.trim();
            if (!value) return;
            let px = size;
            ctx.font = `${weight} ${px}px ${family}`;
            const width = ctx.measureText(value).width;
            if (width > TEXT_MAX) {
                px = Math.max(12, Math.floor((size * TEXT_MAX) / width));
                ctx.font = `${weight} ${px}px ${family}`;
            }
            ctx.fillStyle = color;
            ctx.fillText(value, TEXT_X, baseline);
        };
        write(name, NAME.size, NAME.weight, NAME.color, NAME.baseline);
        write(line1, LINE_SIZE, 400, LINES[0].color, LINES[0].baseline);
        write(line2, LINE_SIZE, 400, LINES[1].color, LINES[1].baseline);
    }, [template, photo, name, line1, line2, fontsReady]);

    const pick = (file: File | undefined) => {
        if (!file || !file.type.startsWith('image/')) return;
        const url = URL.createObjectURL(file);
        loadImage(url)
            .then((img) => {
                if (ownUrl.current) URL.revokeObjectURL(ownUrl.current);
                ownUrl.current = url;
                setPhoto(img);
            })
            .catch(() => URL.revokeObjectURL(url));
    };

    const download = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'coding-for-change-new-joiner.png';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'image/png');
    };

    return (
        <section className="ob-section ob-li" aria-labelledby="ob-li">
            <div className="ob-section__head">
                <h2 className="ob-section__title" id="ob-li">
                    {o.liTitle}
                </h2>
                <span className="ob-badge">{o.liOptional}</span>
            </div>
            <div className="ob-card ob-card--pad ob-li__card">
                <div className="ob-li__preview">
                    <canvas ref={canvasRef} className="ob-li__canvas" role="img" aria-label={o.liPostTitle} />
                </div>
                <div className="ob-li__side">
                    <p className="ob-li__title">{o.liPostTitle}</p>
                    <p className="ob-muted">{o.liLead}</p>
                    <label className="ob-li__field">
                        <span>{o.liName}</span>
                        <input
                            className="ob-input"
                            value={name}
                            maxLength={60}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </label>
                    <label className="ob-li__field">
                        <span>{o.liLine1}</span>
                        <input
                            className="ob-input"
                            value={line1}
                            maxLength={70}
                            onChange={(e) => setLine1(e.target.value)}
                        />
                    </label>
                    <label className="ob-li__field">
                        <span>{o.liLine2}</span>
                        <input
                            className="ob-input"
                            value={line2}
                            maxLength={70}
                            placeholder={o.liLine2Placeholder}
                            onChange={(e) => setLine2(e.target.value)}
                        />
                    </label>
                    <div className="ob-li__actions">
                        <label className="ob-btn ob-btn--outline ob-li__pick">
                            {photo ? o.liPhotoChange : o.liPhotoChoose}
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={(e) => {
                                    pick(e.target.files?.[0]);
                                    e.target.value = '';
                                }}
                            />
                        </label>
                        <button
                            className="ob-btn ob-btn--primary"
                            type="button"
                            disabled={!template}
                            onClick={download}
                        >
                            {o.liDownloadPost} ↓
                        </button>
                    </div>
                    <p className="ob-muted ob-muted--small">{failed ? o.liFailed : o.liPhotoNote}</p>
                </div>
            </div>

            <div className="ob-card ob-card--pad ob-li__banner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="ob-li__bannerimg" src={BANNER} alt="" width={1400} height={349} loading="lazy" />
                <div className="ob-li__bannertext">
                    <p className="ob-li__title">{o.liBannerTitle}</p>
                    <p className="ob-muted">{o.liBannerText}</p>
                </div>
                <a className="ob-btn ob-btn--outline" href={BANNER} download="coding-for-change-linkedin-banner.jpeg">
                    {o.liDownloadBanner} ↓
                </a>
            </div>
        </section>
    );
};

export default OnboardingLinkedIn;
