'use client';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCmsCollection, mediaUrl } from '../../api';
import type { CmsCompany, CmsTeamMember } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import { linkMarkMap } from '../general/SocialMarks';
import PartnerMarquee, { type MarqueePartner } from './PartnerMarquee';
import ClosingCta from './ClosingCta';
import './landing.css';

const reveal = {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
} as const;

const initials = (name: string) =>
    name
        .split(' ')
        .map((n) => n[0])
        .join('');

/**
 * Every company, university or programme the members list under "Previously
 * at", most frequent first – the logo strip on /team, and the talent section
 * of /partners.
 */
export const memberCompanies = (members: CmsTeamMember[]): MarqueePartner[] => {
    const seen = new Map<number, { company: CmsCompany; count: number; first: number }>();
    members.forEach((member, i) => {
        for (const c of member.companies ?? []) {
            if (typeof c !== 'object' || !c) continue;
            const entry = seen.get(c.id);
            if (entry) entry.count += 1;
            else seen.set(c.id, { company: c, count: 1, first: i });
        }
    });
    return [...seen.values()]
        .sort((a, b) => b.count - a.count || a.first - b.first)
        .map(({ company }) => ({
            key: `company-${company.id}`,
            name: company.name,
            logo: mediaUrl(company.logo, 'card'),
        }));
};

/** The bio as a finished sentence, the name it opens with in bold. */
const BioText: React.FC<{ name: string; bio: string }> = ({ name, bio }) => {
    const first = name.split(' ')[0];
    const text = /[.!?…]$/.test(bio) ? bio : `${bio}.`;
    if (!first || !text.startsWith(first)) return <>{text}</>;
    return (
        <>
            <strong>{first}</strong>
            {text.slice(first.length)}
        </>
    );
};

/**
 * One member: portrait, name with LinkedIn/GitHub, role. The bio (studies,
 * work, a fun fact) pops up as a speech bubble above the portrait – under the
 * pointer, on a tap, or on keyboard focus – so the wall stays short. It opens
 * kept inside the screen, and below the tile when there is no room above.
 */
const Face: React.FC<{ member: CmsTeamMember; index: number }> = ({ member, index }) => {
    const photo = mediaUrl(member.image, 'card');
    const links = (member.links ?? []).filter((link) => link.url);
    const bio = member.bio?.trim();
    const bubbleId = useId();
    const tileRef = useRef<HTMLLIElement>(null);
    const bubbleRef = useRef<HTMLParagraphElement>(null);
    const lastPointer = useRef('mouse');
    const [open, setOpen] = useState(false);
    const [spot, setSpot] = useState({ x: 0, tail: 0, below: false });

    const show = () => {
        const tile = tileRef.current;
        const bubble = bubbleRef.current;
        if (!tile || !bubble) return;
        const box = tile.getBoundingClientRect();
        const width = bubble.offsetWidth;
        const center = box.left + box.width / 2;
        const left = Math.min(Math.max(16, center - width / 2), document.documentElement.clientWidth - 16 - width);
        const navBottom = document.querySelector('.lp-nav')?.getBoundingClientRect().bottom ?? 0;
        setSpot({ x: left - box.left, tail: center - left, below: box.top - bubble.offsetHeight - 24 < navBottom });
        setOpen(true);
    };
    const hide = () => setOpen(false);

    // A tap or click anywhere else, or Escape, closes it.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: PointerEvent) => {
            if (!tileRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const portrait = photo ? (
        <img src={photo} alt={member.image?.alt || member.name} loading="lazy" />
    ) : (
        <span className="lp-face__initials">{initials(member.name)}</span>
    );

    return (
        <motion.li
            ref={tileRef}
            className="lp-face"
            data-open={open || undefined}
            data-place={spot.below ? 'below' : undefined}
            onPointerEnter={(e) => {
                if (bio && e.pointerType === 'mouse') show();
            }}
            onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') hide();
            }}
            {...reveal}
            transition={{ duration: 0.4, delay: (index % 6) * 0.04 }}
        >
            {bio ? (
                <button
                    type="button"
                    className="lp-face__photo"
                    aria-label={member.name}
                    aria-expanded={open}
                    aria-describedby={bubbleId}
                    onPointerDown={(e) => {
                        lastPointer.current = e.pointerType;
                    }}
                    onFocus={(e) => {
                        if (e.currentTarget.matches(':focus-visible')) show();
                    }}
                    onBlur={(e) => {
                        if (!tileRef.current?.contains(e.relatedTarget as Node)) hide();
                    }}
                    onClick={(e) => {
                        // The mouse opens it by hovering; a tap or Enter toggles it.
                        if (e.detail === 0 || lastPointer.current !== 'mouse') {
                            if (open) hide();
                            else show();
                        }
                    }}
                >
                    {portrait}
                    <span className="lp-face__hint" aria-hidden="true">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                            <path d="M3 2.5h10a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 13 11.5H8L4.5 14v-2.5H3A1.5 1.5 0 0 1 1.5 10V4A1.5 1.5 0 0 1 3 2.5z" />
                        </svg>
                    </span>
                </button>
            ) : (
                <div className="lp-face__photo">{portrait}</div>
            )}
            {bio && (
                <p
                    ref={bubbleRef}
                    id={bubbleId}
                    role="tooltip"
                    className="lp-face__bubble"
                    style={{ '--bubble-x': `${spot.x}px`, '--bubble-tail': `${spot.tail}px` } as React.CSSProperties}
                >
                    <BioText name={member.name} bio={bio} />
                </p>
            )}
            <div className="lp-face__head">
                <h2 className="lp-face__name">{member.name}</h2>
                {links.length > 0 && (
                    <span className="lp-face__links">
                        {links.map((link) => {
                            const Mark = linkMarkMap[link.label];
                            return (
                                <a
                                    className="lp-face__link"
                                    key={link.label}
                                    href={link.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={`${member.name} on ${link.label}`}
                                >
                                    {Mark ? <Mark /> : link.label}
                                </a>
                            );
                        })}
                    </span>
                )}
            </div>
            <p className="lp-face__role">{member.role}</p>
        </motion.li>
    );
};

export interface TeamGridProps {
    team?: CmsTeamMember[] | null;
}

/**
 * /team – short on purpose: who we are in one line, everyone's face (in the
 * order the CMS sets by drag and drop) with a last tile for whoever joins
 * next, then where the members have worked – the faces show students we are
 * real people, the logos show recruiters where they come from.
 */
const TeamGrid: React.FC<TeamGridProps> = (props) => {
    const { t } = useLanguage();
    const { data: team, loading } = useCmsCollection<CmsTeamMember>(
        'team',
        { depth: '2', sort: '_order' },
        props.team
    );

    const members = useMemo(() => (team ?? []).filter((m) => m.category !== 'adviser'), [team]);
    const advisers = useMemo(() => (team ?? []).filter((m) => m.category === 'adviser'), [team]);
    const companies = useMemo(() => memberCompanies(team ?? []), [team]);

    return (
        <div className="lp">
            <div className="lp-page lp-page--team">
                <div className="lp-inner">
                    <motion.div
                        className="lp-page__head"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <p className="lp-kicker">{t.team.subtitle}</p>
                        <h1 className="lp-page__title">{t.team.title}</h1>
                        <p className="lp-lead">{t.team.intro}</p>
                    </motion.div>
                </div>
            </div>

            <section className="lp-section lp-people-band">
                <div className="lp-inner">
                    {loading && members.length === 0 ? (
                        <p className="lp-loading">Loading…</p>
                    ) : (
                        <ul className="lp-faces">
                            {members.map((member, i) => (
                                <Face key={member.id} member={member} index={i} />
                            ))}
                            <li className="lp-face">
                                <Link className="lp-face__join" href="/join" data-cta="team-join">
                                    <span className="lp-face__photo lp-face__photo--join" aria-hidden="true">
                                        +
                                    </span>
                                    <span className="lp-face__head">
                                        <span className="lp-face__name">{t.team.joinTileTitle}</span>
                                    </span>
                                    <span className="lp-face__role">{t.team.joinTileHint} →</span>
                                </Link>
                            </li>
                        </ul>
                    )}

                    {advisers.length > 0 && (
                        <>
                            <h2 className="lp-h2 lp-faces__title">{t.team.advisersTitle}</h2>
                            <ul className="lp-faces">
                                {advisers.map((member, i) => (
                                    <Face key={member.id} member={member} index={i} />
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </section>

            <PartnerMarquee partners={companies} label={t.team.experienceTitle} variant="strip" />
            <ClosingCta />
        </div>
    );
};

export default TeamGrid;
