'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';
import { APPLICATION_STEPS, stepState } from '../../lib/applicationPhase';
import './join.css';

export interface JoinStepsProps {
    /** Epoch ms the steps are drawn against (done / current / upcoming). */
    now: number;
    /**
     * 'large' – /join, beside the project showcase. 'compact' – the side
     * column of /join/apply. Both run down a vertical line.
     */
    variant?: 'large' | 'compact';
}

/**
 * The application round in three steps – apply, interview, you're in – each
 * with its dates and a line of what happens. The dates in
 * `lib/applicationPhase.ts` decide which step is running, so the "now" badge
 * moves on its own as the round goes by.
 */
const JoinSteps: React.FC<JoinStepsProps> = ({ now, variant = 'large' }) => {
    const { t } = useLanguage();
    return (
        <ol className={`jn-steps jn-steps--${variant}`}>
            {APPLICATION_STEPS.map((step, i) => {
                const state = stepState(step, now);
                const copy = t.join.steps[step.id];
                return (
                    <motion.li
                        key={step.id}
                        className="jn-step"
                        data-state={state}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 0.45, delay: i * 0.1 }}
                    >
                        <div className="jn-step__rail" aria-hidden="true">
                            <span className="jn-step__node">{state === 'done' ? '✓' : i + 1}</span>
                            {i < APPLICATION_STEPS.length - 1 && <span className="jn-step__line" />}
                        </div>
                        <div className="jn-step__body">
                            <span className="jn-step__timing">{copy.timing}</span>
                            <h3 className="jn-step__title">
                                {copy.title}
                                {state === 'current' && (
                                    <span className="jn-step__now">{t.join.stepNow}</span>
                                )}
                            </h3>
                            <p className="jn-step__text">{copy.text}</p>
                        </div>
                    </motion.li>
                );
            })}
        </ol>
    );
};

export default JoinSteps;
