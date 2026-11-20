'use client';
import React, { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCmsCollection, useCmsGlobal, useSiteConfig, mediaUrl } from '../../api';
import type { CmsProject, CmsSponsor, CmsTeamMember, CmsTechTour } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import { MEMBER_STATS } from '../../lib/memberStats';
import PartnerMarquee, { type MarqueePartner } from './PartnerMarquee';
import Recognition from './Recognition';
import SponsorTiers from './SponsorTiers';
import ClosingCta from './ClosingCta';
import { memberCompanies } from './TeamGrid';
import './landing.css';

const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
} as const;

/** The photo on each format card (Drive → Marketing → Photos). */
const FORMAT_PHOTOS: Record<string, string> = {
    company: '/images/partners/company-events.webp',
    community: '/images/partners/community-events.webp',
    hackathon: '/images/hero/hackathon-picus.webp',
};

/**
 * Who has hosted each format, by name. The logos are looked up in the CMS –
 * the TechTour's evenings, the sponsors and the members' companies – so a
 * logo changed there changes here; a host without one is set as its name.
 */
/** The companies we have run events with, for the moving band under the head. */
const EVENT_PARTNERS = ['McKinsey QuantumBlack', 'QuantCo', 'CHECK24', 'Lio', 'BEO', 'Project A', 'Picus Capital'];

/** Logos we ship for hosts the CMS has none for (public/images/logos). */
const LOCAL_LOGOS: Record<string, string> = {
    beo: '/images/logos/beo.svg',
};

/** The photo beside the head: our members at work in a partner's office. */
const HEAD_PHOTO = '/images/hero/hackathon-laptops.webp';

const FORMAT_HOSTS: Record<string, string[]> = {
    company: ['McKinsey QuantumBlack', 'Project A', 'QuantCo', 'Lio'],
    community: ['CHECK24', 'BEO', 'QuantCo', 'Lio'],
    hackathon: ['Picus Capital'],
};
/** How many hosts a format card shows as logos before "+N more". */
const HOSTS_SHOWN = 2;

/**
 * Scroll to a section of this page. A plain hash link would reload the page
 * inside the 3D scene, whose <base target="_parent"> sends it to the parent.
 */
const scrollTo = (id: string) => (e: React.MouseEvent) => {
    const el = document.getElementById(id);
    if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

/**
 * One split as bars on a shared 0–100 scale, in the order lib/memberStats.ts
 * gives (the "& other" bucket last); each value is printed at the bar's tip.
 */
const ShareBars: React.FC<{ label: string; items: { key: string; name: string; share: number }[] }> = ({
    label,
    items,
}) => {
    const { locale } = useLanguage();
    const percent = (n: number) => (locale === 'de' ? `${n} %` : `${n}%`);
    const shown = items.filter((item) => item.share > 0);
    return (
        <figure className="lp-shares__chart">
            <figcaption className="lp-shares__label">{label}</figcaption>
            <ul className="lp-shares__list">
                {shown.map((item) => (
                    <li className="lp-shares__row" key={item.key} title={`${item.name}: ${percent(item.share)}`}>
                        <span className="lp-shares__name">{item.name}</span>
                        <span className="lp-shares__track" aria-hidden="true">
                            <span className="lp-shares__bar" style={{ width: `${item.share}%` }} />
                        </span>
                        <span className="lp-shares__value">{percent(item.share)}</span>
                    </li>
                ))}
            </ul>
        </figure>
    );
};

export interface SponsorsListProps {
    sponsors?: CmsSponsor[] | null;
    team?: CmsTeamMember[] | null;
    projects?: CmsProject[] | null;
    techTour?: CmsTechTour | null;
}

/**
 * /partners – the page for companies, led by proof instead of prose. The
 * first screen holds the promise, a photo of our members at work and a
 * moving band with the companies we have run events with; then the three formats
 * with photos and hosts, who our members are (figures, universities,
 * degrees, where they have worked), our press and awards, and the sponsors.
 */
const SponsorsList: React.FC<SponsorsListProps> = (props) => {
    const { t } = useLanguage();
    const p = t.pages;
    const memberCount = useSiteConfig().memberCount;
    const { data: sponsors } = useCmsCollection<CmsSponsor>('sponsors', { depth: '1' }, props.sponsors);
    const { data: team } = useCmsCollection<CmsTeamMember>(
        'team',
        { depth: '2', sort: '_order' },
        props.team
    );
    const { data: projects } = useCmsCollection<CmsProject>('projects', { depth: '1' }, props.projects);
    const { data: techTour } = useCmsGlobal<CmsTechTour>('tech-tour', props.techTour);

    const companies = useMemo(() => memberCompanies(team ?? []), [team]);
    // Every logo the CMS knows, by lower-cased name: members' companies, then
    // the TechTour's hosts, then the sponsors (later sources win).
    const logoByName = useMemo(() => {
        const map = new Map<string, string>();
        const put = (name: string | null | undefined, logo: string | null) => {
            if (name && logo) map.set(name.trim().toLowerCase(), logo);
        };
        companies.forEach((c) => put(c.name, c.logo));
        (techTour?.events ?? []).forEach((ev) => put(ev.company, mediaUrl(ev.logo, 'card')));
        (sponsors ?? []).forEach((s) => put(s.name, mediaUrl(s.logo, 'card')));
        Object.entries(LOCAL_LOGOS).forEach(([name, logo]) => {
            if (!map.has(name)) map.set(name, logo);
        });
        return map;
    }, [companies, techTour, sponsors]);

    const eventPartners: MarqueePartner[] = EVENT_PARTNERS.map((name) => ({
        key: `event-${name}`,
        name,
        logo: logoByName.get(name.toLowerCase()) ?? null,
    }));

    const figures = [
        { value: memberCount?.trim() ?? '', label: t.team.statMembers },
        ...p.partnersFigures,
    ].filter((figure) => figure.value !== '');
    const universities = MEMBER_STATS.universities.map((u) => ({ ...u, name: p.partnersUnis[u.key] }));
    const degrees = MEMBER_STATS.degrees.map((d) => ({ ...d, name: p.partnersDegrees[d.key] }));

    return (
        <div className="lp">
            <div className="lp-page lp-page--partners">
                <div className="lp-inner">
                    <div className="lp-split-head">
                        <motion.div
                            className="lp-page__head"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <p className="lp-kicker">{p.partnersKicker}</p>
                            <h1 className="lp-page__title">{p.partnersTitle}</h1>
                            <p className="lp-lead">{p.partnersLead}</p>
                            <div className="lp-page__actions">
                                <Link className="lp-btn lp-btn--primary" href="/contact" data-cta="partners-contact">
                                    {p.partnersCta} →
                                </Link>
                                <a className="lp-btn lp-btn--ghost" href="#formats" onClick={scrollTo('formats')}>
                                    {p.partnersFormatsCta}
                                </a>
                            </div>
                        </motion.div>
                        <motion.figure
                            className="lp-split-head__photo"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                        >
                            <img src={HEAD_PHOTO} alt={p.partnersPhotoAlt} />
                        </motion.figure>
                    </div>
                </div>
            </div>

            {/* ---- Who we have run events with: a moving band, on the first screen ---- */}
            <PartnerMarquee partners={eventPartners} label={p.partnersEventLabel} />

            {/* ---- The three formats, side by side ---- */}
            <section id="formats" className="lp-section lp-formats">
                <div className="lp-inner">
                    <motion.div className="lp-head" {...reveal} transition={{ duration: 0.5 }}>
                        <p className="lp-kicker">{p.partnersFormatsLabel}</p>
                        <h2 className="lp-h2">{p.partnersFormatsTitle}</h2>
                    </motion.div>
                    <div className="lp-formats__grid">
                        {p.partnersFormats.map((format, i) => (
                            <motion.article
                                className="lp-format"
                                key={format.key}
                                {...reveal}
                                transition={{ duration: 0.45, delay: i * 0.06 }}
                            >
                                <div className="lp-format__photo">
                                    <img src={FORMAT_PHOTOS[format.key]} alt={format.alt} loading="lazy" />
                                </div>
                                <div className="lp-format__body">
                                    <h3 className="lp-format__title">{format.title}</h3>
                                    <p className="lp-format__text">{format.text}</p>
                                    <div className="lp-format__hosts">
                                        <span className="lp-format__hosts-label">{p.partnersHostsLabel}</span>
                                        <ul className="lp-format__logos">
                                            {(FORMAT_HOSTS[format.key] ?? []).slice(0, HOSTS_SHOWN).map((name) => {
                                                const logo = logoByName.get(name.toLowerCase());
                                                return (
                                                    <li className="lp-format__logo" key={name}>
                                                        {logo ? <img src={logo} alt={name} /> : <span>{name}</span>}
                                                    </li>
                                                );
                                            })}
                                            {(FORMAT_HOSTS[format.key] ?? []).length > HOSTS_SHOWN && (
                                                <li
                                                    className="lp-format__more"
                                                    title={(FORMAT_HOSTS[format.key] ?? []).slice(HOSTS_SHOWN).join(', ')}
                                                >
                                                    +{(FORMAT_HOSTS[format.key] ?? []).length - HOSTS_SHOWN} {p.partnersHostsMore}
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            </motion.article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ---- Talent: headline figures, universities, degrees ---- */}
            <section className="lp-section lp-talent">
                <div className="lp-inner">
                    <motion.div className="lp-head lp-head--split" {...reveal} transition={{ duration: 0.5 }}>
                        <div className="lp-head__copy">
                            <p className="lp-kicker">{p.partnersTalentLabel}</p>
                            <h2 className="lp-h2">{p.partnersTalentTitle}</h2>
                        </div>
                        <Link className="lp-textlink" href="/team">
                            {p.partnersTeamCta} →
                        </Link>
                    </motion.div>
                    {figures.length > 0 && (
                        <motion.ul className="lp-figures lp-figures--three" {...reveal} transition={{ duration: 0.5 }}>
                            {figures.map((figure) => (
                                <li className="lp-figure" key={figure.label}>
                                    <span className="lp-figure__value">{figure.value}</span>
                                    <span className="lp-figure__label">{figure.label}</span>
                                </li>
                            ))}
                        </motion.ul>
                    )}
                    <motion.div className="lp-shares" {...reveal} transition={{ duration: 0.5, delay: 0.06 }}>
                        <ShareBars label={p.partnersUniLabel} items={universities} />
                        <ShareBars label={p.partnersDegreeLabel} items={degrees} />
                    </motion.div>
                </div>
            </section>
            <PartnerMarquee partners={companies} label={t.team.experienceTitle} variant="strip" />

            {/* ---- Press and awards ---- */}
            <Recognition projects={projects} />

            {/* ---- Who already supports us (CMS: Sponsors) ---- */}
            {(sponsors?.length ?? 0) > 0 && (
                <section className="lp-section lp-wall">
                    <div className="lp-inner">
                        <motion.div className="lp-head" {...reveal} transition={{ duration: 0.5 }}>
                            <p className="lp-kicker">{p.partnersWallLabel}</p>
                            <h2 className="lp-h2">{p.partnersWallTitle}</h2>
                        </motion.div>
                        <SponsorTiers sponsors={sponsors} />
                    </div>
                </section>
            )}

            <ClosingCta />
        </div>
    );
};

export default SponsorsList;
