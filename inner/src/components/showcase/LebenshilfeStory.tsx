'use client';
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import Head from './CaseStudyHead';
import './lebenshilfe.css';

/* The Lebenshilfe case study's own chapters, between the facts strip and the
   CMS blocks: how school assistance works, the timesheet before and after the
   portal, and where Lebenshilfe is. They are specific to this one project (a
   diagram, two flows, a map), so they live here in code rather than as CMS
   blocks; ProjectCaseStudy mounts them by slug.

   Figures and their sources are the ones researched for the design (canvas
   "Lebenshilfe Projektseite", option D, Nov 2026). Change a figure only
   together with its source line. */

const ASSETS = '/images/projects/lebenshilfe';

type Copy = {
    how: {
        kicker: string;
        heading: string;
        lead: string;
        roles: { title: string; sub: string }[];
        relations: { cares: string; employs: string; pays: string; hours: string; proof: string };
        sr: string[];
        portalTitle: string;
        portalSub: string;
        note: string;
    };
    flow: {
        kicker: string;
        heading: string;
        lead: string;
        before: { label: string; heading: string; steps: string[]; text: string; alt: string };
        after: { label: string; heading: string; steps: string[]; text: string; alt: string };
    };
    reach: {
        kicker: string;
        heading: string;
        lead: string;
        figures: { value: string; label: string; mark?: 'dot' | 'ring' }[];
        mapAlt: string;
        pilot: string;
        sourcesLabel: string;
        sources: string;
    };
};

const COPY: Record<'de' | 'en', Copy> = {
    de: {
        how: {
            kicker: '~/so-funktionierts',
            heading: 'So funktioniert Schulbegleitung.',
            lead: 'Schulbegleiter:innen sind im Schulalltag für Kinder mit Behinderung da. So können viele von ihnen eine reguläre Schule besuchen, und darauf haben sie ein Recht. Der Kostenträger bezahlt jede Stunde, die nachgewiesen ist.',
            roles: [
                { title: 'Kind', sub: 'mit Behinderung' },
                { title: 'Schulbegleiter:in', sub: 'im Schulalltag' },
                { title: 'Lebenshilfe', sub: 'Träger vor Ort' },
                { title: 'Kostenträger', sub: 'Bezirk oder Jugendamt' },
            ],
            relations: {
                cares: 'begleitet',
                employs: 'stellt ein',
                pays: 'bezahlt',
                hours: 'Stunden',
                proof: 'Nachweis',
            },
            sr: [
                'Die Schulbegleitung begleitet das Kind.',
                'Die Lebenshilfe stellt die Schulbegleitung ein, die Schulbegleitung meldet ihre Stunden an die Lebenshilfe.',
                'Der Kostenträger bezahlt die Lebenshilfe, die Lebenshilfe schickt ihm den Nachweis.',
            ],
            portalTitle: 'Hier setzt unser Portal an',
            portalSub: 'Stunden digital erfassen und nachweisen',
            note: 'In Bayern ist der Kostenträger meist der Bezirk (§ 112 SGB IX), bei seelischer Behinderung das Jugendamt (§ 35a SGB VIII).',
        },
        flow: {
            kicker: '~/vorher-nachher',
            heading: 'Vom Papier zur Plattform.',
            lead: 'So kommt eine geleistete Stunde heute zum Kostenträger, und so mit dem Portal.',
            before: {
                label: 'bisher',
                heading: 'Viel Handarbeit, jeden Monat',
                steps: ['Auf Papier notieren', 'Zettel einreichen', 'Büro tippt alles ab', 'Nachweis von Hand'],
                text: 'Jeden Monat über 150 Zettel: von Hand ausgefüllt, korrigiert, eingereicht und im Büro abgetippt.',
                alt: 'Ein unordentlicher Stapel leicht zerknitterter Einsatznachweise auf Papier mit handschriftlichen Zeiten und Korrekturen',
            },
            after: {
                label: 'mit dem Portal',
                heading: 'Zwei Schritte, alles digital',
                steps: ['Am Handy unterschreiben', 'Nachweis mit einem Klick'],
                text: 'Stunden werden am Handy erfasst und unterschrieben. Der Nachweis für den Kostenträger entsteht mit einem Klick.',
                alt: 'Digitaler Einsatznachweis Schulbegleitung: Angaben zu Kind, Schule und Schulbegleiterin, Tabelle mit Datum, Uhrzeit und Stunden, Summe und digitale Unterschrift. Davor die Tagesansicht der App am Handy mit einem unterschriebenen Eintrag.',
            },
        },
        reach: {
            kicker: '~/vor-ort',
            heading: 'Die Lebenshilfe ist fast überall vor Ort.',
            lead: 'Allein in Bayern hatten 2024 rund 27.000 Kinder eine Schulbegleitung, und der Bedarf wächst. Viele Lebenshilfe-Vereinigungen bieten sie an. Nach dem Pilot in München soll das Portal weiteren Vereinigungen offenstehen.',
            figures: [
                { value: '465', label: 'Orts- und Kreisvereinigungen', mark: 'dot' },
                { value: '16', label: 'Landesverbände, einer pro Bundesland' },
                { value: '150+', label: 'Schulbegleiter:innen bei der Lebenshilfe München', mark: 'ring' },
            ],
            mapAlt: 'Deutschlandkarte mit 465 Punkten für die Orts- und Kreisvereinigungen der Lebenshilfe, München ist hervorgehoben',
            pilot: 'Pilot München',
            sourcesLabel: 'Quellen',
            sources: 'Standortverzeichnis der Bundesvereinigung Lebenshilfe (lebenshilfe.de/standorte, Stand 21.11.2026); Lebenshilfe e. V. im Lobbyregister des Bundestags (2026); Bayerisches Sozialministerium via dpa (Feb. 2026), Werte für 2024: 20.085 Fälle über die Bezirke, 6.842 über die Jugendämter; Lebenshilfe München. Karte: svg-maps/germany, CC BY 4.0.',
        },
    },
    en: {
        how: {
            kicker: '~/how-it-works',
            heading: 'How school assistance works.',
            lead: 'School assistants support children with disabilities through the school day. That is how many of them can attend a regular school, which is their right. The funding body pays for every hour that is documented.',
            roles: [
                { title: 'Child', sub: 'with a disability' },
                { title: 'School assistant', sub: 'in the school day' },
                { title: 'Lebenshilfe', sub: 'local provider' },
                { title: 'Funding body', sub: 'district or youth office' },
            ],
            relations: {
                cares: 'supports',
                employs: 'employs',
                pays: 'pays',
                hours: 'Hours',
                proof: 'Proof',
            },
            sr: [
                'The school assistant supports the child.',
                'Lebenshilfe employs the school assistant, who reports their hours to Lebenshilfe.',
                'The funding body pays Lebenshilfe, which sends it the proof.',
            ],
            portalTitle: 'This is where our portal comes in',
            portalSub: 'Record and document hours digitally',
            note: 'In Bavaria the funding body is usually the district (§ 112 SGB IX), or the youth office for mental disabilities (§ 35a SGB VIII).',
        },
        flow: {
            kicker: '~/before-after',
            heading: 'From paper to platform.',
            lead: 'How an hour of work reaches the funding body today, and how it does with the portal.',
            before: {
                label: 'until now',
                heading: 'A lot of manual work, every month',
                steps: ['Write it on paper', 'Hand in the sheet', 'Office types it up', 'Proof by hand'],
                text: 'Over 150 sheets every month: filled in by hand, corrected, handed in and typed up in the office.',
                alt: 'A messy pile of slightly crumpled paper timesheets with handwritten times and corrections',
            },
            after: {
                label: 'with the portal',
                heading: 'Two steps, all digital',
                steps: ['Sign on the phone', 'Proof in one click'],
                text: 'Hours are recorded and signed on the phone. The proof for the funding body is ready in one click.',
                alt: 'Digital timesheet for school assistance: child, school and assistant, a table of dates, times and hours, the total and a digital signature. In front, the app’s day view on a phone with a signed entry.',
            },
        },
        reach: {
            kicker: '~/on-site',
            heading: 'Lebenshilfe is almost everywhere.',
            lead: 'In Bavaria alone, around 27,000 children had a school assistant in 2024, and the need is growing. Many Lebenshilfe associations provide it. After the pilot in Munich, the portal is meant to be open to more of them.',
            figures: [
                { value: '465', label: 'local and district associations', mark: 'dot' },
                { value: '16', label: 'state associations, one per federal state' },
                { value: '150+', label: 'school assistants at Lebenshilfe München', mark: 'ring' },
            ],
            mapAlt: 'Map of Germany with 465 dots for the local and district associations of Lebenshilfe, Munich highlighted',
            pilot: 'Pilot Munich',
            sourcesLabel: 'Sources',
            sources: 'Location directory of the Bundesvereinigung Lebenshilfe (lebenshilfe.de/standorte, as of 21 Nov 2026); Lebenshilfe e. V. in the Bundestag lobby register (2026); Bavarian Ministry of Social Affairs via dpa (Feb. 2026), figures for 2024: 20,085 cases through the districts, 6,842 through the youth offices; Lebenshilfe München. Map: svg-maps/germany, CC BY 4.0.',
        },
    },
};

/* ---- Icons: inline strokes in the brand colours, decorative only ---- */

const Svg: React.FC<{ children: React.ReactNode; stroke?: string; size?: number }> = ({
    children,
    stroke = 'currentColor',
    size = 20,
}) => (
    <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        {children}
    </svg>
);

const ICONS = {
    child: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <path d="M9 9h.01" />
            <path d="M15 9h.01" />
        </>
    ),
    assistant: (
        <>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M16 11l2 2 4-4" />
        </>
    ),
    heart: (
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
    ),
    bank: (
        <>
            <path d="M3 22h18" />
            <path d="M6 18v-7" />
            <path d="M10 18v-7" />
            <path d="M14 18v-7" />
            <path d="M18 18v-7" />
            <path d="M12 2l8 5H4z" />
        </>
    ),
    phone: (
        <>
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <path d="M12 18h.01" />
        </>
    ),
    pen: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />,
    mail: (
        <>
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </>
    ),
    keyboard: (
        <>
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.01" />
            <path d="M10 8h.01" />
            <path d="M14 8h.01" />
            <path d="M18 8h.01" />
            <path d="M8 12h.01" />
            <path d="M12 12h.01" />
            <path d="M16 12h.01" />
            <path d="M7 16h10" />
        </>
    ),
    sheet: (
        <>
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
        </>
    ),
    download: (
        <>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M7 10l5 5 5-5" />
            <path d="M12 15V3" />
        </>
    ),
};

/** An arrow between two roles. Horizontal on a wide screen, vertical once the
 *  diagram stacks; both are drawn and CSS shows the one that fits. */
const Arrow: React.FC<{ to: 'back' | 'on'; tone: 'grey' | 'petrol' }> = ({ to, tone }) => (
    <>
        <svg
            className={`lh-arrow lh-arrow--h lh-arrow--${tone}`}
            aria-hidden="true"
            width="68"
            height="10"
            viewBox="0 0 68 10"
        >
            {to === 'back' ? (
                <>
                    <path d="M67 5H8" />
                    <path className="lh-arrow__head" d="M1 5l8-4v8z" />
                </>
            ) : (
                <>
                    <path d="M1 5h59" />
                    <path className="lh-arrow__head" d="M67 5l-8-4v8z" />
                </>
            )}
        </svg>
        <svg
            className={`lh-arrow lh-arrow--v lh-arrow--${tone}`}
            aria-hidden="true"
            width="10"
            height="68"
            viewBox="0 0 10 68"
        >
            {to === 'back' ? (
                <>
                    <path d="M5 67V8" />
                    <path className="lh-arrow__head" d="M5 1l-4 8h8z" />
                </>
            ) : (
                <>
                    <path d="M5 1v59" />
                    <path className="lh-arrow__head" d="M5 67l-4-8h8z" />
                </>
            )}
        </svg>
    </>
);

/* ---- 1. How school assistance works: four roles, who does what ---- */

const HowItWorks: React.FC<{ c: Copy['how'] }> = ({ c }) => {
    const icons = [ICONS.child, ICONS.assistant, ICONS.heart, ICONS.bank];
    const role = (i: number) => (
        <div className="lh-role" style={{ gridArea: `r${i}` }}>
            <span className="lh-role__icon">
                <Svg stroke="var(--cfc-petrol)">{icons[i]}</Svg>
            </span>
            <span className="lh-role__text">
                <span className="lh-role__title">{c.roles[i].title}</span>
                <span className="lh-role__sub">{c.roles[i].sub}</span>
            </span>
        </div>
    );
    return (
        <section className="lp-cs-sec">
            <div className="lp-inner">
                <Head kicker={c.kicker} heading={c.heading} lead={c.lead} />
                <div className="lh-diagram">
                    {role(0)}
                    <div className="lh-link" style={{ gridArea: 'l0' }}>
                        <span className="lh-sr">{c.sr[0]}</span>
                        <span className="lh-rel lh-rel--back">
                            <span className="lh-rel__label">{c.relations.cares}</span>
                            <Arrow to="back" tone="grey" />
                        </span>
                    </div>
                    {role(1)}
                    <div className="lh-link" style={{ gridArea: 'l1' }}>
                        <span className="lh-sr">{c.sr[1]}</span>
                        <span className="lh-rel lh-rel--back">
                            <span className="lh-rel__label">{c.relations.employs}</span>
                            <Arrow to="back" tone="grey" />
                        </span>
                        <span className="lh-rel lh-rel--on">
                            <Arrow to="on" tone="petrol" />
                            <span className="lh-rel__label">{c.relations.hours}</span>
                        </span>
                    </div>
                    {role(2)}
                    <div className="lh-link" style={{ gridArea: 'l2' }}>
                        <span className="lh-sr">{c.sr[2]}</span>
                        <span className="lh-rel lh-rel--back">
                            <span className="lh-rel__label">{c.relations.pays}</span>
                            <Arrow to="back" tone="grey" />
                        </span>
                        <span className="lh-rel lh-rel--on">
                            <Arrow to="on" tone="petrol" />
                            <span className="lh-rel__label">{c.relations.proof}</span>
                        </span>
                    </div>
                    {role(3)}
                    {/* The bracket spans the roles the hours pass through; the
                        portal sits on it. */}
                    <div className="lh-portal" style={{ gridArea: 'p' }}>
                        <span className="lh-portal__bracket" aria-hidden="true" />
                        <span className="lh-portal__pill">
                            <span className="lh-portal__icon">
                                <Svg stroke="var(--cfc-phosphor)" size={18}>
                                    {ICONS.phone}
                                </Svg>
                            </span>
                            <span className="lh-portal__text">
                                <span className="lh-portal__title">{c.portalTitle}</span>
                                <span className="lh-portal__sub">{c.portalSub}</span>
                            </span>
                        </span>
                    </div>
                </div>
                <p className="lh-note">{c.note}</p>
            </div>
        </section>
    );
};

/* ---- 2. Before and after: the timesheet's way to the funding body ---- */

const Steps: React.FC<{ steps: string[]; icons: React.ReactNode[]; dark?: boolean }> = ({
    steps,
    icons,
    dark,
}) => (
    <ol
        className={'lh-steps' + (dark ? ' lh-steps--dark' : '')}
        style={{ '--steps': steps.length } as React.CSSProperties}
    >
        {steps.map((s, i) => (
            <React.Fragment key={s}>
                {i > 0 && (
                    <li
                        className="lh-steps__arrow"
                        aria-hidden="true"
                        style={{ '--at': i } as React.CSSProperties}
                    />
                )}
                <li className="lh-steps__step">
                    <span className="lh-steps__icon">
                        <Svg>{icons[i]}</Svg>
                    </span>
                    <span className="lh-steps__label">{s}</span>
                </li>
            </React.Fragment>
        ))}
    </ol>
);

const BeforeAfter: React.FC<{ c: Copy['flow'] }> = ({ c }) => (
    <section className="lp-cs-sec">
        <div className="lp-inner">
            <Head kicker={c.kicker} heading={c.heading} lead={c.lead} />
            <div className="lh-compare">
                <div className="lh-card">
                    <div className="lh-card__body">
                        <div className="lh-card__head">
                            <span className="lh-card__label">{c.before.label}</span>
                            <h3 className="lh-card__h">{c.before.heading}</h3>
                        </div>
                        <Steps
                            steps={c.before.steps}
                            icons={[ICONS.pen, ICONS.mail, ICONS.keyboard, ICONS.sheet]}
                        />
                        <p className="lh-card__text">{c.before.text}</p>
                    </div>
                    <div className="lh-card__media">
                        <img
                            src={`${ASSETS}/paper-timesheets.webp`}
                            alt={c.before.alt}
                            width={640}
                            height={446}
                            loading="lazy"
                        />
                    </div>
                </div>
                <div className="lh-card lh-card--dark">
                    <div className="lh-card__body">
                        <div className="lh-card__head">
                            <span className="lh-card__label">{c.after.label}</span>
                            <h3 className="lh-card__h">{c.after.heading}</h3>
                        </div>
                        <Steps steps={c.after.steps} icons={[ICONS.phone, ICONS.download]} dark />
                        <p className="lh-card__text">{c.after.text}</p>
                    </div>
                    <div className="lh-card__media lh-card__media--wide">
                        <img
                            src={`${ASSETS}/digital-timesheet.webp`}
                            alt={c.after.alt}
                            width={720}
                            height={579}
                            loading="lazy"
                        />
                    </div>
                </div>
            </div>
        </div>
    </section>
);

/* ---- 3. Where Lebenshilfe is: the map and three figures, on petrol ---- */

const Reach: React.FC<{ c: Copy['reach'] }> = ({ c }) => (
    <section className="lp-cs-sec lh-reach">
        <div className="lp-inner">
            {/* Head, map and figures are siblings: beside each other on a wide
                screen, map between head and figures on a phone. */}
            <div className="lh-reach__grid">
                <div className="lh-reach__head">
                    <Head kicker={c.kicker} heading={c.heading} lead={c.lead} />
                </div>
                <figure className="lh-map">
                    <img
                        src={`${ASSETS}/germany-locations.svg`}
                        alt={c.mapAlt}
                        width={586}
                        height={793}
                        loading="lazy"
                    />
                    <span className="lh-map__pin" aria-hidden="true">
                        {c.pilot}
                    </span>
                </figure>
                <dl className="lh-figures">
                    {c.figures.map((f) => (
                        <div className="lh-figures__row" key={f.value}>
                            <dt className="lh-figures__value">{f.value}</dt>
                            <dd className="lh-figures__label">
                                {f.mark && (
                                    <span
                                        className={`lh-figures__mark lh-figures__mark--${f.mark}`}
                                        aria-hidden="true"
                                    />
                                )}
                                {f.label}
                            </dd>
                        </div>
                    ))}
                </dl>
            </div>
            {/* The sources in full on a wide screen; folded away on a phone. */}
            <p className="lh-sources">
                {c.sourcesLabel}: {c.sources}
            </p>
            <details className="lh-sources-fold">
                <summary className="lh-sources-fold__summary">
                    {c.sourcesLabel}
                    <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M6 9l6 6 6-6" />
                    </svg>
                </summary>
                <p className="lh-sources-fold__text">{c.sources}</p>
            </details>
        </div>
    </section>
);

const LebenshilfeStory: React.FC = () => {
    const { locale } = useLanguage();
    const c = COPY[locale === 'de' ? 'de' : 'en'];
    return (
        <>
            <HowItWorks c={c.how} />
            <BeforeAfter c={c.flow} />
            <Reach c={c.reach} />
        </>
    );
};

export default LebenshilfeStory;
