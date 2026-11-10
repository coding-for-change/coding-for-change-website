'use client';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { TimelineStep } from './ProcessTimeline';
import './landing.css';

const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
} as const;

/** "Week 8" -> "Week 08": the mono labels line up like a terminal column. */
const padWeek = (timing: string) => timing.replace(/\d+/, (n) => n.padStart(2, '0'));

export interface ProcessStepsProps {
    id?: string;
    kicker: string;
    heading: string;
    intro?: string;
    steps: TimelineStep[];
    /** The button under the steps. */
    cta?: { label: string; href: string; dataCta?: string };
}

/**
 * How we work with NGOs: the steps side by side on a petrol band, each with
 * its point in time in mono. Shared by the homepage and /ngos. On the homepage
 * the band takes its colour from the scroll painter (data-bg); elsewhere it
 * paints its own.
 */
const ProcessSteps: React.FC<ProcessStepsProps> = ({ id, kicker, heading, intro, steps, cta }) => (
    <section id={id} data-bg="#0b4643" className="lp-section lp-section--dark lp-steps-band">
        <div className="lp-inner">
            <motion.div className="lp-head" {...reveal} transition={{ duration: 0.5 }}>
                <p className="lp-kicker">{kicker}</p>
                <h2 className="lp-h2">{heading}</h2>
                {intro && <p className="lp-lead">{intro}</p>}
            </motion.div>
            <ol className="lp-steps">
                {steps.map((step, i) => (
                    <motion.li
                        key={`${i}-${step.title}`}
                        className="lp-step"
                        {...reveal}
                        transition={{ duration: 0.45, delay: Math.min(i * 0.08, 0.3) }}
                    >
                        {step.timing && <span className="lp-step__when">{padWeek(step.timing)}</span>}
                        <h3 className="lp-step__title">{step.title}</h3>
                        {step.text && <p className="lp-step__text">{step.text}</p>}
                        {step.cta && (
                            <Link className="lp-step__cta" href={step.cta.href}>
                                {step.cta.label} →
                            </Link>
                        )}
                    </motion.li>
                ))}
            </ol>
            {cta && (
                <div className="lp-steps__more">
                    <Link className="lp-btn lp-btn--light" href={cta.href} data-cta={cta.dataCta}>
                        {cta.label} →
                    </Link>
                </div>
            )}
        </div>
    </section>
);

export default ProcessSteps;
