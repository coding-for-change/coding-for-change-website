'use client';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useCmsGlobal, useHomepageMode } from '../../api';
import useNow from '../../hooks/useNow';
import { applicationStatus } from '../../lib/applicationPhase';
import { CmsHomepage } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import './landing.css';

const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
} as const;

export interface ClosingCtaProps {
    homepage?: CmsHomepage | null;
}

/**
 * The closing claim at the bottom of every content page ("Good software is
 * not a privilege."), with one button per audience: NGOs, students,
 * companies. The footer's >_♡ follows it. Copy comes from the `homepage`
 * global (Closing call-to-action) and falls back to i18n. On /ngos the NGO
 * button scrolls to the booking tool. /join has its own closing, tied to the
 * application round.
 *
 * While the homepage is in student mode (Site Configuration → Homepage
 * audience), the claim borrows the round's closing copy and the student
 * button goes straight to /join/apply.
 */
const ClosingCta: React.FC<ClosingCtaProps> = (props) => {
    const { t } = useLanguage();
    const l = t.landing;
    const { data: hp } = useCmsGlobal<CmsHomepage>('homepage', props.homepage);
    const pathname = usePathname() ?? '';

    const students = useHomepageMode() === 'students';
    const status = applicationStatus(useNow());

    const heading = students ? t.join.closing.heading : hp?.ctaHeading || l.closingClaim;
    const text = students ? t.join.closing.text[status] : hp?.ctaText || l.closingText;
    const joinLabel = students
        ? (status === 'open' && hp?.studentHeroCtaPrimary) || t.join.cta[status]
        : hp?.ctaJoin || l.closingJoin;
    const joinHref = students ? '/join/apply' : '/join';
    const ngoLabel = hp?.ctaContact || l.closingNgo;
    const onNgoPage = pathname.startsWith('/ngos');

    const toBooking = (e: React.MouseEvent) => {
        const el = document.getElementById('partner-book');
        if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const ngoButton = (primary: boolean) => {
        const cls = 'lp-btn ' + (primary ? 'lp-btn--primary' : 'lp-btn--ghost');
        return onNgoPage ? (
            <a className={cls} href="#partner-book" onClick={toBooking} data-cta="closing-ngo">
                {ngoLabel}
                {primary && ' →'}
            </a>
        ) : (
            <Link className={cls} href="/ngos" data-cta="closing-ngo">
                {ngoLabel}
                {primary && ' →'}
            </Link>
        );
    };
    const joinButton = (primary: boolean) => (
        <Link
            className={'lp-btn ' + (primary ? 'lp-btn--primary' : 'lp-btn--ghost')}
            href={joinHref}
            data-cta="closing-join"
        >
            {joinLabel}
            {primary && ' →'}
        </Link>
    );

    return (
        <section className="lp-closing" data-bg="#f1f0ea">
            <div className="lp-inner">
                <motion.div style={{ display: 'block' }} {...reveal} transition={{ duration: 0.5 }}>
                    <h2 className="lp-closing__claim">
                        {heading}
                        <span className="lp-cursor lp-cursor--ink" aria-hidden="true" />
                    </h2>
                    <p className="lp-closing__text">{text}</p>
                    <div className="lp-closing__ctas">
                        {students ? joinButton(true) : ngoButton(true)}
                        {students ? ngoButton(false) : joinButton(false)}
                        {/* On /partners itself, the companies' button asks them to get in touch. */}
                        {pathname.startsWith('/partners') ? (
                            <Link className="lp-btn lp-btn--ghost" href="/contact" data-cta="closing-partner">
                                {t.pages.partnersCta}
                            </Link>
                        ) : (
                            <Link className="lp-btn lp-btn--ghost" href="/partners" data-cta="closing-partner">
                                {l.closingPartner}
                            </Link>
                        )}
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default ClosingCta;
