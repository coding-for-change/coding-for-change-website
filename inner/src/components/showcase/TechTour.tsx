'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MotionConfig, motion } from 'framer-motion';
import { mediaUrl, useCmsGlobal } from '../../api';
import type { CmsTechTour, CmsTechTourEvent } from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';
import { usePageTone } from '../../hooks/useDarkNav';
import { formatDateRange, known, techTourRegistrationOpen } from '../../lib/techTour';
import TechTourSkyline from './TechTourSkyline';
import './techtour.css';

export interface TechTourProps {
    techTour?: CmsTechTour | null;
    /** Request time from the server component; see BecomeAMember for why. */
    serverNow?: number;
}

/**
 * Dates in Munich time, wherever the visitor is. The tour happens there, and a
 * deadline at 23:59 is already the next day further east – which would also
 * make the server's HTML disagree with the browser's.
 */
const TZ = 'Europe/Berlin';

/**
 * The host's logo – the full one, with the company's name in it – at one
 * height and whatever width it needs. A host without a logo yet gets its name
 * set in type in the same place.
 */
const HostLogo: React.FC<{ ev: CmsTechTourEvent; className: string }> = ({ ev, className }) => {
    const logo = mediaUrl(ev.logo, 'card');
    return logo ? (
        <img className={`${className} tt-logo`} src={logo} alt={ev.company} />
    ) : (
        <span className={`${className} tt-logo tt-logo--name`}>{ev.company}</span>
    );
};

/**
 * The Munich Tech Tour: four evenings at four tech companies, each one its own
 * event, open to every student.
 *
 * The page is the route. Up top the pitch – what it is, when, one button – and
 * the hosts' logos; then a teal line drops out of a `>_` prompt, runs down
 * through a drawing of the Munich skyline and stops once per evening, the
 * stops alternating either side of it (on a phone the line moves to the left
 * edge and every stop hangs off its right). It ends in a station, and below
 * that the ask comes once more with the deadline as the headline.
 *
 * Everything on it comes from the TechTour global in the CMS – the evenings,
 * their order and dates, the deadline and whether applications are open –
 * and the wording around it from the translation table (`techtour`). The form
 * itself is on /techtour/apply, where every "Apply" here leads.
 */
const TechTour: React.FC<TechTourProps> = (props) => {
    const { t, locale } = useLanguage();
    const tc = t.techtour;
    const { data: tt } = useCmsGlobal<CmsTechTour>('tech-tour', props.techTour);
    usePageTone('paper');

    const [now, setNow] = useState(() => props.serverNow ?? Date.now());
    useEffect(() => {
        setNow(Date.now());
    }, []);
    const open = techTourRegistrationOpen(tt, now);
    const dateLocale = locale === 'de' ? 'de-DE' : 'en-GB';

    const events = useMemo(
        () =>
            [...(tt?.events ?? [])].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            ),
        [tt]
    );

    // "Four evenings at four companies": the count spelled out while it is
    // small enough to read as a word, in figures beyond that.
    const count = events.length;
    const countWord =
        count >= 2 && count < tc.numbers.length ? tc.numbers[count] : String(count);
    const withCount = (text: string) => text.split('{count}').join(countWord);
    const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

    const range = useMemo(() => {
        const dates = events
            .map((ev) => new Date(ev.date))
            .filter((d) => !Number.isNaN(d.getTime()));
        if (dates.length === 0) return '';
        return formatDateRange(dates[0], dates[dates.length - 1], dateLocale, {
            month: 'short',
            timeZone: TZ,
        });
    }, [events, dateLocale]);

    const deadlineDate = tt?.registrationDeadline ? new Date(tt.registrationDeadline) : null;
    const deadline =
        deadlineDate && !Number.isNaN(deadlineDate.getTime())
            ? deadlineDate.toLocaleDateString(dateLocale, {
                  day: 'numeric',
                  month: 'long',
                  timeZone: TZ,
              })
            : '';

    const hosts = events.filter((ev) => ev.status !== 'tba');
    const closedText = tt?.closedMessage || tc.closedFallback;

    // Fades in on arrival. Under reduced motion only the fade is left: the
    // MotionConfig below drops the movement, and the server's HTML stays the
    // same either way (branching on the setting here would not hydrate).
    const rise = (delay = 0) => ({
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, delay },
    });
    const reveal = {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.3 },
        transition: { duration: 0.5 },
    };

    return (
        <MotionConfig reducedMotion="user">
            <div className="tt">
                <header className="tt-hero">
                    <motion.div className="tt-hero__inner" {...rise()}>
                        <span className={`tt-badge${open ? '' : ' tt-badge--closed'}`}>
                            {open ? tc.badgeOpen : tc.badgeClosed}
                        </span>
                        <p className="tt-kicker">
                            {tc.kicker}
                            {range && <> · {range}</>}
                            <span className="tt-kicker__city"> · {tc.city}</span>
                        </p>
                        <h1 className="tt-hero__title">{tc.title}</h1>
                        {count > 0 && (
                            <p className="tt-hero__lead">{sentence(withCount(tc.lead))}</p>
                        )}
                        {open ? (
                            <div className="tt-hero__cta">
                                <Link className="tt-btn" href="/techtour/apply">
                                    {tc.applyCta}
                                </Link>
                                <span className="tt-hero__note">
                                    {withCount(tc.applyNote)}
                                    {deadline && <> · {tc.until.replace('{date}', deadline)}</>}
                                </span>
                            </div>
                        ) : (
                            <p className="tt-hero__closed">{closedText}</p>
                        )}
                    </motion.div>
                    {hosts.length > 0 && (
                        <motion.ul className="tt-hosts" aria-label={tc.hostsLabel} {...rise(0.15)}>
                            {hosts.map((ev, i) => (
                                <li className="tt-hosts__item" key={ev.id ?? i}>
                                    <HostLogo ev={ev} className="tt-hosts__logo" />
                                </li>
                            ))}
                        </motion.ul>
                    )}
                </header>

                {count > 0 && (
                    <section className="tt-route" aria-label={tc.routeLabel}>
                        <span className="tt-route__line" aria-hidden="true" />
                        <span className="tt-route__start" aria-hidden="true">
                            &gt;_
                        </span>
                        <TechTourSkyline />
                        <ol className="tt-stops">
                            {events.map((ev, i) => {
                                const tba = ev.status === 'tba';
                                const company = tba ? tc.tbaCompany : ev.company;
                                const date = new Date(ev.date);
                                const time = known(ev.time);
                                const place = known(ev.location);
                                // What is known comes first; whatever is still
                                // open trails behind it.
                                const meta =
                                    time && place
                                        ? [time, place]
                                        : time
                                          ? [time, tc.placeTba]
                                          : place
                                            ? [place, tc.timeTba]
                                            : [tc.timeTba, tc.placeTba];
                                // A slot without a host has no logo; if it already
                                // has a headline, the logo's place says who is
                                // still missing (without one, the headline does).
                                const logo = tba ? null : (
                                    <HostLogo ev={ev} className="tt-stop__logo" />
                                );
                                return (
                                    <motion.li className="tt-stop" key={ev.id ?? i} {...reveal}>
                                        <p className="tt-stop__label">
                                            {tc.stop.replace('{n}', String(i + 1))} ·{' '}
                                            {date.toLocaleDateString(dateLocale, {
                                                weekday: 'long',
                                                timeZone: TZ,
                                            })}
                                            {ev.status === 'tentative' && (
                                                <span className="tt-stop__flag">{tc.tentative}</span>
                                            )}
                                        </p>
                                        <p className="tt-stop__date">
                                            {date.toLocaleDateString(dateLocale, {
                                                day: 'numeric',
                                                month: 'short',
                                                timeZone: TZ,
                                            })}
                                            <span className="tt-stop__node" aria-hidden="true" />
                                        </p>
                                        {logo &&
                                            (ev.website ? (
                                                <a
                                                    className="tt-stop__site"
                                                    href={ev.website}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    aria-label={tc.websiteLabel.replace(
                                                        '{company}',
                                                        ev.company
                                                    )}
                                                >
                                                    {logo}
                                                </a>
                                            ) : (
                                                logo
                                            ))}
                                        {tba && ev.title && (
                                            <p className="tt-stop__tba">{company}</p>
                                        )}
                                        <h2 className="tt-stop__title">{ev.title || company}</h2>
                                        <p className="tt-stop__meta">{meta.join(' · ')}</p>
                                        {open && (
                                            <Link className="tt-stop__apply" href="/techtour/apply">
                                                {tc.stopApply} →
                                            </Link>
                                        )}
                                        <p className="tt-stop__note">{tc.stopNote}</p>
                                    </motion.li>
                                );
                            })}
                        </ol>
                        <span className="tt-route__end" aria-hidden="true" />
                    </section>
                )}

                {/* Closed, the hero has already said so; there is nothing to ask
                    for down here. */}
                {open && (
                    <motion.section className="tt-end" {...reveal}>
                        <p className="tt-end__kicker">{tc.endKicker}</p>
                        <h2 className="tt-end__title">
                            {deadline ? tc.endTitle.replace('{date}', deadline) : tc.applyCta}
                        </h2>
                        {count > 0 && <p className="tt-end__text">{withCount(tc.endText)}</p>}
                        <Link className="tt-btn" href="/techtour/apply">
                            {tc.applyCta}
                        </Link>
                    </motion.section>
                )}
            </div>
        </MotionConfig>
    );
};

export default TechTour;
