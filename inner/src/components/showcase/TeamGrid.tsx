'use client';
import React, { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCmsCollection, mediaUrl } from '../../api';
import type { CmsCompany, CmsTeamMember } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import { linkMarkMap } from '../general/SocialMarks';
import type { MarqueePartner } from './PartnerMarquee';
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

/** The page shows first names only, whatever the profile in the CMS holds. */
const firstName = (member: CmsTeamMember) => member.name.trim().split(/\s+/)[0];

const companiesOf = (member: CmsTeamMember): CmsCompany[] =>
    (member.companies ?? []).filter((c): c is CmsCompany => typeof c === 'object' && c !== null);

/**
 * Every company, university or programme the members list under "Previously
 * at", most frequent first – the logos under the project teams on /team, and
 * the talent section of /partners.
 */
export const memberCompanies = (members: CmsTeamMember[]): MarqueePartner[] => {
    const seen = new Map<number, { company: CmsCompany; count: number; first: number }>();
    members.forEach((member, i) => {
        for (const c of companiesOf(member)) {
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

/** One person and what they look after in one department. */
interface Placed {
    member: CmsTeamMember;
    role: string;
}

interface Group {
    id: number;
    name: string;
    order: number;
    people: Placed[];
}

/**
 * The departments of the CMS ("Teams" collection), each with its people and
 * what they look after, and everyone who is in none of them. Whoever leads a
 * department (a role starting "Leitung", "Lead" or "Head") comes first; the
 * rest keep the page's order.
 */
const groupTeam = (members: CmsTeamMember[]) => {
    const groups = new Map<number, Group>();
    const rest: CmsTeamMember[] = [];
    for (const member of members) {
        let placed = false;
        for (const membership of member.teamMemberships ?? []) {
            const team = membership.team;
            if (!team || typeof team !== 'object') continue;
            placed = true;
            let group = groups.get(team.id);
            if (!group) {
                group = { id: team.id, name: team.name, order: team.order ?? 100, people: [] };
                groups.set(team.id, group);
            }
            group.people.push({ member, role: membership.role?.trim() || member.role });
        }
        if (!placed) rest.push(member);
    }
    const leads = (person: Placed) => /^(leitung|lead|head)\b/i.test(person.role);
    const sorted = [...groups.values()].sort((a, b) => a.order - b.order || a.id - b.id);
    for (const group of sorted) {
        group.people.sort((a, b) => Number(leads(b)) - Number(leads(a)));
    }
    return { groups: sorted, rest };
};

/** The portrait, cropped square around the focal point set on the image in the CMS. */
const Portrait: React.FC<{ member: CmsTeamMember; size: 'card' | 'thumbnail' }> = ({ member, size }) => {
    const photo = mediaUrl(member.image, size);
    const focus = `${member.image?.focalX ?? 50}% ${member.image?.focalY ?? 50}%`;
    return photo ? (
        <img src={photo} alt={firstName(member)} loading="lazy" style={{ objectPosition: focus }} />
    ) : (
        <span className="lp-role__initials">{initials(member.name)}</span>
    );
};

/** The person's LinkedIn, as its mark on the portrait. */
const LinkedInBadge: React.FC<{ member: CmsTeamMember }> = ({ member }) => {
    const link = (member.links ?? []).find((l) => l.url && l.label === 'LinkedIn');
    if (!link) return null;
    const Mark = linkMarkMap.LinkedIn;
    return (
        <a
            className="lp-role__badge"
            href={link.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`${firstName(member)} on LinkedIn`}
        >
            <Mark />
        </a>
    );
};

/**
 * Where someone has worked or studied, as small grey logos in even boxes:
 * the first `max`, then "+N" for the rest.
 */
const CompanyLogos: React.FC<{ companies: MarqueePartner[]; max?: number }> = ({ companies, max = 2 }) => {
    const { t } = useLanguage();
    if (companies.length === 0) return null;
    const shown = companies.slice(0, max);
    const more = companies.length - shown.length;
    return (
        <ul className="lp-logos" aria-label={t.team.experienceTitle}>
            {shown.map((company) => (
                <li className="lp-logos__item" key={company.key} title={company.name}>
                    {company.logo ? (
                        <img src={company.logo} alt={company.name} loading="lazy" />
                    ) : (
                        <span className="lp-logos__name">{company.name}</span>
                    )}
                </li>
            ))}
            {more > 0 && <li className="lp-logos__more">+{more}</li>}
        </ul>
    );
};

const logosOf = (member: CmsTeamMember): MarqueePartner[] =>
    companiesOf(member).map((c) => ({ key: `company-${c.id}`, name: c.name, logo: mediaUrl(c.logo, 'thumbnail') }));

/**
 * One person and what they look after: the portrait (LinkedIn on it), the
 * name right under it, the topic, where they have worked.
 */
const RoleCard: React.FC<{ person: Placed; index: number }> = ({ person, index }) => {
    const { member, role } = person;
    return (
        <motion.li className="lp-role" {...reveal} transition={{ duration: 0.4, delay: (index % 6) * 0.04 }}>
            <div className="lp-role__photo">
                <Portrait member={member} size="card" />
                <LinkedInBadge member={member} />
            </div>
            <p className="lp-role__name">{firstName(member)}</p>
            <p className="lp-role__topic">{role}</p>
            <CompanyLogos companies={logosOf(member)} />
        </motion.li>
    );
};

/** A department: its name on the left, its responsibilities beside it. */
const DeptRow: React.FC<{ name: string; people: Placed[] }> = ({ name, people }) => (
    <div className="lp-dept">
        <h3 className="lp-dept__name">{name}</h3>
        <ul className="lp-roles">
            {people.map((person, i) => (
                <RoleCard key={person.member.id} person={person} index={i} />
            ))}
        </ul>
    </div>
);

const PILE = 10;

/**
 * The last row: everyone who is in no department, as a row of small faces
 * and where they have worked, then the way in. No count: not everyone in
 * the project teams has a profile in the CMS.
 */
const MoreRow: React.FC<{ rest: CmsTeamMember[] }> = ({ rest }) => {
    const { t } = useLanguage();
    const companies = useMemo(() => memberCompanies(rest).slice(0, 8), [rest]);
    const faces = rest.slice(0, PILE);
    return (
        <div className="lp-dept">
            <h3 className="lp-dept__name">{t.team.moreTitle}</h3>
            <motion.div className="lp-more" {...reveal} transition={{ duration: 0.4 }}>
                {rest.length > 0 && (
                    <>
                        <ul className="lp-pile" aria-hidden="true">
                            {faces.map((member) => (
                                <li className="lp-pile__face" key={member.id} title={firstName(member)}>
                                    <Portrait member={member} size="thumbnail" />
                                </li>
                            ))}
                        </ul>
                        <p className="lp-more__text">{t.team.moreText}</p>
                        <CompanyLogos companies={companies} max={8} />
                    </>
                )}
                <Link className="lp-more__cta" href="/join" data-cta="team-join">
                    {t.team.joinTileHint} →
                </Link>
            </motion.div>
        </div>
    );
};

export interface TeamGridProps {
    team?: CmsTeamMember[] | null;
}

/**
 * /team: who looks after what. One row per department of the CMS ("Teams",
 * by order) with a card per responsibility – the topic first, then the
 * person, then where they have worked – and everyone else as a row of faces
 * with a count. Without any departments in the CMS, everyone shows as a card.
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
    const { groups, rest } = useMemo(() => groupTeam(members), [members]);

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

            <section className="lp-team">
                <div className="lp-inner">
                    {loading && members.length === 0 ? (
                        <p className="lp-loading">Loading…</p>
                    ) : groups.length === 0 ? (
                        <ul className="lp-roles lp-roles--wide">
                            {rest.map((member, i) => (
                                <RoleCard key={member.id} person={{ member, role: member.role }} index={i} />
                            ))}
                        </ul>
                    ) : (
                        <>
                            {groups.map((group) => (
                                <DeptRow key={group.id} name={group.name} people={group.people} />
                            ))}
                            <MoreRow rest={rest} />
                        </>
                    )}
                    {advisers.length > 0 && (
                        <DeptRow
                            name={t.team.advisersTitle}
                            people={advisers.map((member) => ({ member, role: member.role }))}
                        />
                    )}
                </div>
            </section>

            <ClosingCta />
        </div>
    );
};

export default TeamGrid;
