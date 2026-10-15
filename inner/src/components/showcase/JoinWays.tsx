'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { mediaUrl } from '../../api';
import type { CmsTeamMember } from '../../api/types';
import { useLanguage } from '../../contexts/LanguageContext';
import { LinkedInMark } from '../general/SocialMarks';
import './join.css';

const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
} as const;

/**
 * The two ways in, each with the member to ask about it – by name as it
 * appears on the Team page, which supplies the photo and the LinkedIn link.
 * A name the Team page doesn't have simply drops the card's footer. `crop`
 * zooms their current Team photo so the face sits centred and at the same
 * size in both circles; revisit it when a photo changes.
 */
const WAYS = [
    { id: 'projects', contact: 'Jakob', crop: { scale: 1.72, origin: '54% 13%' } },
    { id: 'taskForce', contact: 'David', crop: { scale: 1.5, origin: '46% 49%' } },
] as const;

const findMember = (team: CmsTeamMember[] | null | undefined, name: string) =>
    (team ?? []).find((m) => m.name.trim().toLowerCase() === name.toLowerCase()) ?? null;

const linkedInOf = (member: CmsTeamMember) =>
    member.links
        ?.find((l) => l.label.trim().toLowerCase() === 'linkedin' || /linkedin\.com/i.test(l.url))
        ?.url.trim() ?? null;

export interface JoinWaysProps {
    /** The members named in WAYS, for the "want to know more?" footers. */
    team?: CmsTeamMember[] | null;
}

/**
 * "Ways to get involved": the head and the two cards. Shared by /join and
 * the student-mode homepage — the caller supplies the section around it.
 */
const JoinWays: React.FC<JoinWaysProps> = ({ team }) => {
    const { t } = useLanguage();
    return (
        <div className="lp-inner">
            <motion.div className="jn-head" {...reveal} transition={{ duration: 0.5 }}>
                <p className="lp-kicker">{t.join.ways.kicker}</p>
                <h2 className="lp-h2">{t.join.ways.heading}</h2>
            </motion.div>
            <div className="jn-ways__grid">
                {WAYS.map((way, i) => {
                    const copy = t.join.ways.items[way.id];
                    const member = findMember(team, way.contact);
                    const linkedIn = member ? linkedInOf(member) : null;
                    const photo = member ? mediaUrl(member.image, 'thumbnail') : null;
                    return (
                        <motion.article
                            key={way.id}
                            className="jn-way"
                            {...reveal}
                            transition={{ duration: 0.5, delay: i * 0.08 }}
                        >
                            <p className="jn-way__label">{copy.label}</p>
                            <h3 className="jn-way__title">{copy.title}</h3>
                            <p className="jn-way__text">{copy.text}</p>
                            <ul className="jn-way__points">
                                {copy.points.map((point) => (
                                    <li key={point}>{point}</li>
                                ))}
                            </ul>
                            {member && linkedIn && (
                                <a
                                    className="jn-way__contact"
                                    href={linkedIn}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={t.join.ways.contactLink.replace(
                                        '{name}',
                                        member.name
                                    )}
                                >
                                    <span className="jn-way__avatar" aria-hidden="true">
                                        {photo ? (
                                            <img
                                                src={photo}
                                                alt=""
                                                loading="lazy"
                                                decoding="async"
                                                style={{
                                                    transform: `scale(${way.crop.scale})`,
                                                    transformOrigin: way.crop.origin,
                                                }}
                                            />
                                        ) : (
                                            member.name.charAt(0)
                                        )}
                                    </span>
                                    <span className="jn-way__person">
                                        <span className="jn-way__person-label">
                                            {t.join.ways.contactLabel}
                                        </span>
                                        <span className="jn-way__person-name">
                                            {member.name}
                                            {member.role && (
                                                <span className="jn-way__person-role">
                                                    {' '}
                                                    · {member.role}
                                                </span>
                                            )}
                                        </span>
                                    </span>
                                    <span className="jn-way__linkedin" aria-hidden="true">
                                        <LinkedInMark />
                                    </span>
                                </a>
                            )}
                        </motion.article>
                    );
                })}
            </div>
        </div>
    );
};

export default JoinWays;
