'use client';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';
import './landing.css';

/**
 * The way into the 3D version of the site (/3d – the retro computer on a desk
 * from outer/): one card with a render of the scene, a line and a button.
 * Desktop only (CSS hides it at the 1024px mobile breakpoint, where /3d is
 * not offered either), and left out inside the 3D scene's own monitor, whose
 * nav already has the way back. The render is a screenshot of the live scene
 * (public/images/3d/scene.webp).
 */
const ThreeDTeaser: React.FC<{ bandColor?: string }> = ({ bandColor }) => {
    const { t } = useLanguage();
    const p = t.pages;
    // Hidden until mounted: window.top is unreadable server-side.
    const [embedded, setEmbedded] = useState(true);
    useEffect(() => {
        try {
            setEmbedded(window.self !== window.top);
        } catch {
            setEmbedded(true);
        }
    }, []);
    if (embedded) return null;

    return (
        <section className="lp-section lp-3d" data-bg={bandColor}>
            <div className="lp-inner">
                <motion.a
                    className="lp-3d__card"
                    href="/3d"
                    data-cta="home-3d"
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="lp-3d__copy">
                        <p className="lp-kicker">{p.threedLabel}</p>
                        <h2 className="lp-3d__title">{p.threedTitle}</h2>
                        <p className="lp-3d__text">{p.threedText}</p>
                        <span className="lp-btn lp-btn--primary">{p.threedCta} →</span>
                    </div>
                    <img className="lp-3d__scene" src="/images/3d/scene.webp" alt="" loading="lazy" />
                </motion.a>
            </div>
        </section>
    );
};

export default ThreeDTeaser;
