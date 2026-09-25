'use client';
import React from 'react';
import { mediaUrl } from '../../api';
import { CmsSponsor } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import './landing.css';

// Fallback ordering for the deprecated fixed `tier` enum (used only when a
// sponsor has no `tierRef` relationship yet).
const FALLBACK_ORDER: Record<string, number> = {
    platinum: 10,
    gold: 20,
    silver: 30,
    bronze: 40,
    partner: 50,
};

// Editors tend to paste a bare domain ("hetzner.com"). Without a scheme the
// browser resolves that as a path on our own site, so assume https.
const externalHref = (url: string) =>
    /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^\/+/, '')}`;

const SponsorLogo: React.FC<{ sponsor: CmsSponsor }> = ({ sponsor }) => {
    const logo = mediaUrl(sponsor.logo);
    const url = sponsor.url?.trim();
    const inner = logo ? (
        <img src={logo} alt={sponsor.name} />
    ) : (
        <span className="lp-sponsor__name">{sponsor.name}</span>
    );
    return url ? (
        <a
            className="lp-sponsor"
            href={externalHref(url)}
            target="_blank"
            rel="noopener noreferrer"
        >
            {inner}
        </a>
    ) : (
        <div className="lp-sponsor">{inner}</div>
    );
};

interface Group {
    key: string;
    label: string;
    order: number;
    items: CmsSponsor[];
}

/**
 * Renders sponsors grouped into tier sections, ordered by the tier's `order`.
 * Tiers are CMS-managed (the `tierRef` relationship); a sponsor that hasn't been
 * moved onto a tier record yet falls back to its deprecated fixed `tier` value.
 */
const SponsorTiers: React.FC<{ sponsors?: CmsSponsor[] | null }> = ({
    sponsors,
}) => {
    const { t } = useLanguage();
    const byKey = new Map<string, Group>();

    for (const s of sponsors ?? []) {
        let key: string;
        let label: string;
        let order: number;
        const ref = s.tierRef;
        if (ref && typeof ref === 'object') {
            key = `tier-${ref.id}`;
            label = ref.label;
            order = ref.order ?? 100;
        } else if (s.tier) {
            key = s.tier;
            label = t.sponsors.tiers[s.tier];
            order = FALLBACK_ORDER[s.tier] ?? 100;
        } else {
            key = '_untiered';
            label = '';
            order = 999;
        }
        if (!byKey.has(key)) byKey.set(key, { key, label, order, items: [] });
        byKey.get(key)!.items.push(s);
    }

    const groups = [...byKey.values()].sort((a, b) => a.order - b.order);
    // Only show tier headings when more than one labelled tier is present.
    const showHeadings = groups.filter((g) => g.label).length > 1;

    return (
        <div className="lp-tiers">
            {groups.map((g) => (
                <div className="lp-tier" key={g.key}>
                    {showHeadings && g.label && (
                        <h3 className="lp-tier__head">{g.label}</h3>
                    )}
                    <div className="lp-sponsors">
                        {g.items.map((sponsor) => (
                            <SponsorLogo key={sponsor.id} sponsor={sponsor} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SponsorTiers;
