'use client';
import React from 'react';
import { mediaUrl } from '../../api';
import type { CmsProject, CmsSponsor, CmsTechTour } from '../../api/types';
import { techTourListed } from '../../lib/techTour';
import './join.css';

export interface MarqueePartner {
    key: string;
    name: string;
    logo: string | null;
    /**
     * Print the name beside the logo. TechTour logos are square marks drawn
     * for the line-up, where the company name always sits next to them – on
     * their own they don't say who it is. Partner and NGO logos are wordmarks.
     */
    named?: boolean;
}

/**
 * Everyone we work with, from the CMS: the NGOs behind our projects, the
 * companies on /partners and – once the TechTour page is listed – the
 * companies hosting its evenings. A name that turns up twice is shown once,
 * and the two kinds alternate so neither clumps at one end of the band.
 */
export const joinPartners = (
    projects: CmsProject[] | null | undefined,
    sponsors: CmsSponsor[] | null | undefined,
    techTour: CmsTechTour | null | undefined
): MarqueePartner[] => {
    const seen = new Set<string>();
    const add = (list: MarqueePartner[], partner: MarqueePartner) => {
        const id = partner.name.trim().toLowerCase();
        if (!id || seen.has(id)) return;
        seen.add(id);
        list.push(partner);
    };

    const ngos: MarqueePartner[] = [];
    (projects ?? []).forEach((p) => {
        if (p.ngoPartner) add(ngos, { key: `ngo-${p.id}`, name: p.ngoPartner, logo: mediaUrl(p.image) });
    });

    const companies: MarqueePartner[] = [];
    (sponsors ?? []).forEach((s) =>
        add(companies, { key: `partner-${s.id}`, name: s.name, logo: mediaUrl(s.logo) })
    );
    if (techTourListed(techTour)) {
        // Only evenings with a confirmed host – a tentative company has not said yes yet.
        (techTour?.events ?? [])
            .filter((ev) => ev.company && (ev.status ?? 'confirmed') === 'confirmed')
            .forEach((ev) =>
                add(companies, {
                    key: `techtour-${ev.company}`,
                    name: ev.company,
                    logo: mediaUrl(ev.logo),
                    named: true,
                })
            );
    }

    const mixed: MarqueePartner[] = [];
    for (let i = 0; i < Math.max(ngos.length, companies.length); i++) {
        if (ngos[i]) mixed.push(ngos[i]);
        if (companies[i]) mixed.push(companies[i]);
    }
    return mixed;
};

/**
 * One pass has to outrun the widest screen, or the loop shows a gap: 16 tiles
 * of 212px cover a 3,392px-wide window.
 */
const MIN_TILES_PER_PASS = 16;

const Tile: React.FC<{ partner: MarqueePartner; hidden: boolean }> = ({ partner, hidden }) => (
    <li
        className={`jn-logo${partner.named || !partner.logo ? ' jn-logo--named' : ''}`}
        aria-hidden={hidden || undefined}
    >
        {partner.logo && (
            // Not lazy: the band moves, and a lazy logo would only start
            // loading as it slides into view – a blank tile first.
            <img
                src={partner.logo}
                alt={partner.named ? '' : partner.name}
                decoding="async"
                draggable={false}
            />
        )}
        {(partner.named || !partner.logo) && <span className="jn-logo__name">{partner.name}</span>}
    </li>
);

/**
 * The logo band under the /join head: every partner slides past, right to
 * left, pausing under the pointer. Each logo is announced once; the repeats
 * that make the loop seamless are hidden from screen readers, and with
 * reduced motion the band stands still with each logo shown once.
 */
const PartnerMarquee: React.FC<{ partners: MarqueePartner[]; label: string }> = ({
    partners,
    label,
}) => {
    if (partners.length === 0) return null;
    const reps = Math.max(1, Math.ceil(MIN_TILES_PER_PASS / partners.length));
    const pass = Array.from({ length: reps }, () => partners).flat();
    const style = { '--jn-marquee-duration': `${pass.length * 5}s` } as React.CSSProperties;

    return (
        <section className="jn-partners" aria-label={label}>
            <p className="jn-partners__label">{label}</p>
            <div className="jn-marquee" style={style}>
                <ul className="jn-marquee__track">
                    {pass.map((p, i) => (
                        <Tile key={`a-${i}-${p.key}`} partner={p} hidden={i >= partners.length} />
                    ))}
                    {pass.map((p, i) => (
                        <Tile key={`b-${i}-${p.key}`} partner={p} hidden />
                    ))}
                </ul>
            </div>
        </section>
    );
};

export default PartnerMarquee;
