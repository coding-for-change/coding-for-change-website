'use client';
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { CmsFaqItem } from '../../api/types';
import './landing.css';

/**
 * Questions as a hairline list, one answer open at a time. Shared by the /qa
 * page and the audience sections on /ngos and /join.
 */
const FaqList: React.FC<{ items: CmsFaqItem[] }> = ({ items }) => {
    const [open, setOpen] = useState<number | null>(null);
    if (items.length === 0) return null;
    return (
        <div className="lp-faq">
            {items.map((item) => {
                const isOpen = open === item.id;
                return (
                    <div key={item.id} className={'lp-faq__item' + (isOpen ? ' lp-faq__item--open' : '')}>
                        <button
                            type="button"
                            className="lp-faq__q"
                            aria-expanded={isOpen}
                            onClick={() => setOpen(isOpen ? null : item.id)}
                        >
                            <span>{item.question}</span>
                            <span className="lp-faq__sign" aria-hidden="true">
                                {isOpen ? '−' : '+'}
                            </span>
                        </button>
                        <AnimatePresence initial={false}>
                            {isOpen && (
                                <motion.div
                                    className="lp-faq__a"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                                >
                                    <p>{item.answer}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
};

export default FaqList;
