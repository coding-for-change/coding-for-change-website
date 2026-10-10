import type { ApplicationStatus, ApplicationStepId } from '../lib/applicationPhase';

export type Locale = 'en' | 'de';

export interface Translations {
    nav: {
        home: string; events: string; projects: string;
        partners: string; team: string; blog: string; qa: string; join: string; contact: string;
        ngos: string; techtour: string;
        /** The bar above the nav while applications are open; {round} e.g. "Winter 2026/27". */
        /** `applyBarShort` replaces `applyBar` on a phone, where the full line wraps. */
        applyBar: string; applyBarShort: string; applyBarCta: string;
    };
    common: {
        learnMore: string; partner: string; at: string;
        enterThreeD: string; exitThreeD: string; unavailable: string;
        close: string;
    };
    home: {
        about: string; events: string; projects: string; team: string; join: string;
        kicker: string; ctaPrimary: string; ctaSecondary: string; scrollHint: string;
        heroLineOne: string; heroLineTwo: string;
    };
    about: {
        title: string;
        kicker: string;
        oneLiner: string;
        pitch: string;
        stats: { value: string; label: string }[];
        howItWorks: string;
        explore: string;
    };
    process: {
        kicker: string; heading: string; intro: string;
        steps: { timing: string; title: string; text: string }[];
    };
    cta: {
        heading: string; text: string; join: string; contact: string;
    };
    projects: {
        title: string; subtitle: string; intro: string; viewAll: string;
        more: string;
        status: { active: string; completed: string; recruiting: string };
    };
    threed: {
        kicker: string; title: string; text: string; cta: string;
        backKicker: string; backTitle: string; backText: string; backCta: string;
    };
    projectDetail: {
        back: string; problem: string; approach: string; outcome: string;
        impact: string; stack: string; links: string;
        timeline: string; team: string; partnerLabel: string;
    };
    caseStudy: {
        chooseKicker: string; chooseTitle: string;
        technicalCardTitle: string; technicalCardText: string;
        impactCardTitle: string; impactCardText: string;
        technicalLabel: string; impactLabel: string;
        joinHeading: string; joinText: string; joinButton: string;
        challengeHeading: string; solutionHeading: string; resultsHeading: string;
        workingHeading: string; workingPoints: string[]; partnerLink: string;
        faqHeading: string; bookHeading: string; bookText: string;
        eyebrow: string; teamLink: string; moreProjects: string;
        pressLabel: string; pressRead: string;
        stepNow: string; stepNext: string;
    };
    events: {
        title: string; subtitle: string; intro: string;
        upcoming: string; past: string;
        emptyTitle: string; emptyText: string; emptyCta: string;
    };
    team: { title: string; subtitle: string; intro: string; advisersTitle: string; experienceLabel: string; projectsLabel: string;
        joinTileTitle: string; joinTileHint: string;
        statMembers: string; statNgos: string; statProjects: string; };
    qa: { title: string; subtitle: string; intro: string; };
    /**
     * /join (the page that makes the case) and /join/apply (the form). Dates
     * written into the copy follow `lib/applicationPhase.ts` – update both
     * together for the next round.
     */
    join: {
        /** Head fallbacks – the CMS Membership global's title and description win. */
        title: string; lead: string;
        /** Secondary button in the head, down to the three steps. */
        howItWorks: string;
        /**
         * The slideshow in the head: what happened in each photo – a casual,
         * lower-case note beside a hand-drawn arrow – with the event's cover
         * image where there is one. `{n}` is the photo number.
         */
        slides: {
            label: string; goTo: string;
            items: Record<
                'marioKart' | 'hackathon' | 'changemakerChat',
                { caption: string; alt: string; posterAlt?: string }
            >;
        };
        /** Where the round stands: "Opens 5 Oct", "Closes 30 Oct", closed. */
        status: Record<ApplicationStatus, string>;
        /** The line under the status. `{n}` is the day count. */
        countdown: {
            opensIn: { one: string; other: string };
            closesIn: { one: string; other: string };
        };
        /** The button to /join/apply, by where the round stands. */
        cta: Record<ApplicationStatus, string>;
        /** The logo band under the head. */
        partnersLabel: string;
        expect: {
            kicker: string; heading: string; lead: string;
            items: Record<'projects' | 'community' | 'companies', { title: string; text: string; alt: string }>;
        };
        ways: {
            kicker: string; heading: string;
            items: Record<'projects' | 'taskForce', { label: string; title: string; text: string; points: string[] }>;
            /** Footer of each card: the member to ask. `{name}` is their first name. */
            contactLabel: string; contactLink: string;
        };
        process: { kicker: string; heading: string };
        /** Beside the steps: a project members built, linking to its case study. `{ngo}` is the partner. */
        showcase: { kicker: string; forNgo: string; link: string; alt: string };
        steps: Record<ApplicationStepId, { timing: string; title: string; text: string }>;
        /** Badge on the step that is running right now. */
        stepNow: string;
        /** The band at the foot of /join. */
        closing: { heading: string; text: Record<ApplicationStatus, string> };
        /** /join/apply. `{round}` is the round label, `{email}` the contact address. */
        apply: {
            back: string; title: string;
            lead: Record<ApplicationStatus, string>;
            contact: string;
            /** Headings the form is split into (who you are, then the application). */
            sectionAbout: string; sectionApplication: string;
            /** Under the form: answers are kept automatically, in this browser only. */
            draftNote: string;
        };
        loadingForm: string; formUnavailable: string;
        waitlistTitle: string; waitlistLead: string;
        /** Heading + lead over the waitlist before the round opens (in place of waitlistTitle / waitlistLead). */
        upcomingTitle: string; upcomingLead: string;
        waitlistEmailLabel: string; waitlistEmailPlaceholder: string;
        waitlistButton: string; waitlistSubmitting: string;
        waitlistSuccess: string; waitlistError: string;
    };
    contact: {
        title: string; intro: string;
        nameLabel: string; namePlaceholder: string;
        emailLabel: string; emailPlaceholder: string;
        orgLabel: string; orgPlaceholder: string;
        messageLabel: string; messagePlaceholder: string;
        sendMessage: string; emailClientNote: string; requiredNote: string;
        submitting: string; sendError: string; loadingForm: string;
        formUnavailable: string; successFallback: string;
    };
    book: { title: string; intro: string; fallback: string; openInNewTab: string; pickTime: string; };
    talk: {
        ngoKicker: string; ngoHeading: string; ngoText: string;
        studentKicker: string; studentHeading: string; studentText: string; studentCta: string;
    };
    /** The CMS `sponsors` collection, which the site calls "Partners". */
    sponsors: {
        title: string; subtitle: string; intro: string;
        tiers: { platinum: string; gold: string; silver: string; bronze: string; partner: string };
    };
    blog: {
        title: string; subtitle: string; searchPlaceholder: string;
        all: string; noPosts: string; back: string; notFound: string;
    };
    navbar: { title: string; subtitle: string; };
    footer: {
        pages: string; info: string;
        home: string; projects: string; team: string; blog: string;
        partners: string; join: string; contact: string; qa: string; ngos: string;
        techtour: string;
        privacy: string; imprint: string; cookieSettings: string;
    };
    /** Shared strings of the CMS form renderer (components/forms/CmsForm). */
    forms: {
        send: string; submitting: string; sendError: string; required: string;
        successFallback: string; chooseAtLeastOne: string; opensNewTab: string;
        linkedUnavailable: string;
        /** The free-text box under a dropdown's "Other" option. */
        otherPlaceholder: string;
        /** Under a textarea with a limit: {n} typed of {max}. */
        charCount: string;
        uploadChoose: string; uploadHint: string; uploading: string; uploadRemove: string;
        uploadTooLarge: string; uploadWrongType: string; uploadFailed: string;
    };
    /**
     * Munich TechTour page (/techtour). The page's own wording lives here and
     * only here — the CMS holds the visits and the registration settings, and
     * overrides just two of these strings (`formHeading`, `closedFallback`).
     */
    techtour: {
        statusOpen: string; statusClosed: string;
        tbaCompany: string; tbaTime: string; tbaLocation: string; tentative: string;
        formHeading: string; closedFallback: string; formUnavailable: string;
        /** The poster's headline. Two words, unlike the one-word brand usage
         *  in the nav and the footer. */
        posterTitle: string;
        /** The three facts on the poster; {count} is the number of evenings. */
        factFormatLabel: string; factDatesLabel: string; factDeadlineLabel: string;
        factEvenings: string;
        /** The one ask: the button, and the page behind it (/techtour/apply). */
        applyCta: string; detailsCta: string; backToTour: string;
        /** The Explore section below the poster. */
        learnMoreCta: string; scrollHint: string; exploreKicker: string;
        exploreHeading: string; exploreLead: string;
        eventApplyCta: string; eventSiteCta: string; tileHint: string;
        factTimeLabel: string; factPlaceLabel: string;
        /**
         * /techtour/apply — the half-filled form a visitor can park and come
         * back to. Saved only when they press the button, only in their own
         * browser (see `cfc-techtour-draft` in klaroConfig's "site basics").
         */
        draftSave: string; draftSaved: string; draftRestored: string;
        draftClear: string; draftCleared: string; draftNote: string;
        /**
         * The three steps above the form, in place of a lead paragraph.
         * `{date}` is the CMS registration deadline and `{range}` the span the
         * tour runs. Step 2 carries no date on purpose — the CMS has no
         * "feedback by" field and we do not promise a day we cannot keep.
         */
        stepApplyTitle: string; stepApplyText: string;
        stepConfirmTitle: string; stepConfirmText: string;
        stepJoinTitle: string; stepJoinText: string;
        /** Heading over the name / email / consent half of the form. */
        sectionDetailsTitle: string;
        /**
         * The one-line reminder under the evening rows. It took the place of a
         * CMS `commitment` field, which was a paragraph where a sentence was
         * wanted.
         */
        attendAsk: string;
    };
    aboutPage: {
        valuesTitle: string;
        values: { title: string; text: string }[];
    };
    partner: {
        kicker: string; fallbackTitle: string; fallbackLead: string;
        talkCta: string;
    };
    notFound: {
        kicker: string; title: string; lead: string;
        backHome: string; helpfulLinks: string;
        projects: string; ngos: string; join: string;
    };
}

const en: Translations = {
    nav: {
        home: 'Home', events: 'Events', projects: 'Projects',
        partners: 'Partners', team: 'Team', blog: 'Blog', qa: 'Q&A', join: 'Join', contact: 'Contact',
        ngos: 'NGOs', techtour: 'TechTour 2026',
        applyBar: 'Applications for {round} are open – until 30 October',
        applyBarShort: 'Applications open until 30 Oct',
        applyBarCta: 'Apply now',
    },
    common: {
        learnMore: 'Learn More', partner: 'Partner:', at: 'at',
        enterThreeD: 'Enter 3D mode', exitThreeD: 'Exit 3D mode',
        unavailable: 'Content unavailable.',
        close: 'Close',
    },
    home: {
        about: 'ABOUT', events: 'EVENTS', projects: 'PROJECTS', team: 'TEAM', join: 'JOIN',
        kicker: 'Gain coding experience while making a difference',
        ctaPrimary: 'Join the club',
        ctaSecondary: 'See our work',
        scrollHint: '↓ scroll to explore',
        heroLineOne: 'Tech meets Social Impact',
        heroLineTwo: 'Built by students. For non-profits.',
    },
    about: {
        title: 'About Us',
        kicker: 'Who we are',
        oneLiner: 'We develop software for NGOs so they can focus on their mission.',
        pitch: 'NGOs have the mission. Students have the skills. We connect the two.',
        stats: [
            { value: '4', label: 'NGOs partnered' },
            { value: '10+', label: 'Active members' },
            { value: '150+', label: 'Users’ time saved' },
        ],
        howItWorks: 'How it works',
        explore: 'Explore',
    },
    process: {
        kicker: 'How it works',
        heading: 'How we work with NGOs',
        intro: 'From first conversation to finished software in a single semester — here is the path every project follows.',
        steps: [
            {
                timing: 'Week 0',
                title: 'First talk',
                text: 'Tell us about your organisation and the problem you want solved — a relaxed 30-minute call, free and non-binding.',
            },
            {
                timing: 'Week 2',
                title: 'Clickable mock-up',
                text: 'You see a first clickable design of your product, and we refine it together until it fits the way your team works.',
            },
            {
                timing: 'Week 8',
                title: 'Working MVP',
                text: 'The core features run with real data, so your team can try the software early and steer what matters most.',
            },
            {
                timing: 'Week 12',
                title: 'Fully featured product',
                text: 'We hand over the finished software — tested, documented and yours, with everything your team needs to run it.',
            },
        ],
    },
    cta: {
        heading: 'Ready to build something great?',
        text: 'Whether you are a student who wants to ship real code or a nonprofit with a problem worth solving — let us talk.',
        join: 'Join the club',
        contact: 'Partner with us',
    },
    projects: {
        title: 'Projects', subtitle: 'Building Tech for Social Good',
        intro: 'We build software for NGOs that makes a real difference — by student teams, together with our partners.',
        viewAll: 'See all projects',
        more: 'More projects',
        status: { active: 'Active', completed: 'Completed', recruiting: 'Recruiting' },
    },
    threed: {
        kicker: 'Just for fun',
        title: 'Prefer the scenic route? Try the 3D site.',
        text: 'There’s a playful 3D version of this site — a little retro desktop you can click around right in your browser.',
        cta: 'Enter the 3D experience',
        backKicker: 'You’re in 3D mode',
        backTitle: 'Prefer the fast, simple version?',
        backText: 'You’re exploring the 3D version of the site. Hop back to the standard site any time — it’s quicker to get around.',
        backCta: 'Back to the standard site',
    },
    projectDetail: {
        back: 'Back to projects', problem: 'The problem', approach: 'Our approach',
        outcome: 'What we shipped', impact: 'Impact', stack: 'Built with', links: 'Links',
        timeline: 'Timeline', team: 'The team', partnerLabel: 'Partner',
    },
    caseStudy: {
        chooseKicker: 'Two ways to read this',
        chooseTitle: 'How would you like to read it?',
        technicalCardTitle: 'Technical deep-dive',
        technicalCardText: 'How we built it — the problem, our approach and the stack. Best if you’re a student thinking about joining.',
        impactCardTitle: 'Impact story',
        impactCardText: 'What a project like this could mean for your organisation. Best if you’re a nonprofit exploring a partnership.',
        technicalLabel: 'Technical deep-dive',
        impactLabel: 'Impact story',
        joinHeading: 'Want to build things like this?',
        joinText: 'This is the kind of real, shipped software you’ll work on as a member — with a team, a real partner, and people who depend on it.',
        joinButton: 'Join the club',
        challengeHeading: 'The challenge',
        solutionHeading: 'What we built',
        resultsHeading: 'The impact',
        workingHeading: 'Working with us',
        workingPoints: [
            'Free of charge — funded by our university backing and partners',
            'Delivered in a single semester by a dedicated student team',
            'You own the result — documented, handed over, no lock-in',
        ],
        partnerLink: 'See how partnering works',
        faqHeading: 'Questions nonprofits ask',
        bookHeading: 'Have a problem worth solving?',
        bookText: 'Tell us about it — grab a slot and we’ll explore whether we can help.',
        pressLabel: 'Featured in',
        pressRead: 'Read the article',
        stepNow: 'In progress',
        stepNext: 'Up next',
        eyebrow: 'Case study',
        teamLink: 'Meet the whole team',
        moreProjects: 'See all projects',
    },
    events: {
        title: 'Events', subtitle: 'Workshops, Hackathons & More',
        intro: 'Join us at our upcoming events or check out what we have been up to!',
        upcoming: 'Upcoming Events', past: 'Past Events',
        emptyTitle: 'Currently no event',
        emptyText: 'Have an idea for an event? Let’s talk.',
        emptyCta: 'Get in touch',
    },
    team: {
        title: 'Our Team', subtitle: 'The People Behind CFC',
        intro: 'Meet the team that drives Coding for Change. We are a diverse group of students passionate about using technology for social good.',
        advisersTitle: 'Advisers',
        experienceLabel: 'Previously at',
        projectsLabel: 'Projects',
        joinTileTitle: 'Your face here',
        joinTileHint: 'We are growing — join the club',
        statMembers: 'Members',
        statNgos: 'NGO partners',
        statProjects: 'Projects',
    },
    qa: {
        title: 'Q&A', subtitle: 'Frequently Asked Questions',
        intro: 'Find answers to common questions about Coding for Change below.',
    },
    join: {
        title: 'Build software that matters',
        lead: 'Join a community of ambitious students who ship real software for non-profits\u00a0– and meet the people and companies shaping Munich’s tech scene.',
        howItWorks: 'How it works',
        slides: {
            label: 'Moments from our events',
            goTo: 'Show photo {n}',
            items: {
                marioKart: {
                    caption: 'here, we took on the CHECK24 team in a Mario Kart tournament',
                    alt: 'Students cheering at the Mario Kart tournament at CHECK24',
                    posterAlt: 'Event poster: Mario Kart tournament, hosted by CHECK24',
                },
                hackathon: {
                    caption: 'here, we spent a weekend building at our mini-hackathon',
                    alt: 'Members at a long table during the mini-hackathon',
                },
                changemakerChat: {
                    caption: 'here, we welcomed the former CEO of Welthungerhilfe for a chat',
                    alt: 'A panel talk with the former CEO of Welthungerhilfe in the TUM Think Tank',
                    posterAlt: 'Event poster: chat with Till Wahnbaeck',
                },
            },
        },
        status: { upcoming: 'Opens 5 Oct', open: 'Closes 30 Oct', closed: 'Applications closed' },
        countdown: {
            opensIn: { one: 'tomorrow', other: 'in {n} days' },
            closesIn: { one: 'last day', other: '{n} days left' },
        },
        cta: { upcoming: 'Get notified', open: 'Apply now', closed: 'Notify me for the next round' },
        partnersLabel: 'Non-profits we build for\u00a0– and the companies at our side',
        expect: {
            kicker: 'What to expect',
            heading: 'More than a side project',
            lead: 'A semester with us means building real software, meeting people you’ll want to keep around, and seeing Munich’s tech companies from the inside.',
            items: {
                projects: {
                    title: 'Project work',
                    text: 'Build software for a non-profit in a small team\u00a0– from the first conversation to launch.',
                    alt: 'Members present their app to the team at Lebenshilfe München',
                },
                community: {
                    title: 'Community events',
                    text: 'Hackathons, talks, socials\u00a0– and the odd Mario Kart tournament.',
                    alt: 'Members around a long table, listening to a talk',
                },
                companies: {
                    title: 'Company visits',
                    text: 'A look behind the scenes at Munich’s top tech companies.',
                    alt: 'A full room of students at a Coding for Change presentation',
                },
            },
        },
        ways: {
            kicker: 'Ways to get involved',
            heading: 'Two ways to make a difference',
            items: {
                projects: {
                    label: 'Projects',
                    title: 'Build software people rely on',
                    text: 'Join a small team, take on a real problem of a non-profit and turn it into a product that is used every day.',
                    points: [
                        'A team and project matched to your skills',
                        'Around five hours a week\u00a0– one team meeting included',
                        'Past partners: Lebenshilfe, Cycling Without Age, edunovo',
                    ],
                },
                taskForce: {
                    label: 'Task Force',
                    title: 'Run the club like a startup',
                    text: 'Behind every project, event and partnership is the Task Force\u00a0– the people who make Coding for Change happen.',
                    points: [
                        'Bring top tech companies on board and host hackathons',
                        'Scout NGOs and uncover the problems worth solving',
                        'Own legal and finance for a registered association',
                    ],
                },
            },
            contactLabel: 'Questions? Reach out!',
            contactLink: '{name} on LinkedIn',
        },
        process: { kicker: 'Application', heading: 'Three steps to your first project' },
        showcase: {
            kicker: 'What you could build',
            forNgo: 'for {ngo}',
            link: 'Read the case study',
            alt: '{title} on a laptop and a phone',
        },
        steps: {
            apply: {
                timing: '5–30 Oct 2026',
                title: 'Apply',
                text: 'A few questions about you, plus your CV.',
            },
            interview: {
                timing: '2–8 Nov 2026',
                title: 'Interview',
                text: 'A conversation and a small hands-on challenge.',
            },
            admission: {
                timing: '9–11 Nov 2026',
                title: 'You’re in',
                text: 'Meet the others at the new-joiner event and find your team.',
            },
        },
        stepNow: 'Now',
        closing: {
            heading: 'Your first project starts here',
            text: {
                upcoming: 'Applications open on 5 October. Leave your email and we’ll let you know the moment the form goes live.',
                open: 'Applications close on 30 October at 23:59.',
                closed: 'This round is closed. Leave your email and you’ll be the first to know when applications reopen.',
            },
        },
        apply: {
            back: 'All about joining',
            title: 'Apply for {round}',
            lead: {
                upcoming: 'The form opens on 5 October.',
                open: 'Take your time with the answers\u00a0– and have your CV ready as a PDF.',
                closed: 'Applications for this round are closed.',
            },
            contact: 'Questions about applying? Email us at {email}.',
            sectionAbout: 'About you',
            sectionApplication: 'Your application',
            draftNote:
                'Your answers are saved automatically in this browser, so you can come back and finish later – we receive nothing until you send the form.',
        },
        loadingForm: 'Loading form…',
        formUnavailable:
            'The application form is currently unavailable. Please email us directly.',
        waitlistTitle: 'Applications are currently closed',
        waitlistLead:
            'Sign up to be the first to know when applications reopen\u00a0– we’ll email you the moment they do.',
        upcomingTitle: 'Applications open on 5 October',
        upcomingLead:
            'Leave your email and we’ll let you know the moment the form goes live.',
        waitlistEmailLabel: 'Email:',
        waitlistEmailPlaceholder: 'you@example.com',
        waitlistButton: 'Notify me',
        waitlistSubmitting: 'Signing up…',
        waitlistSuccess:
            'You’re on the list! We’ll email you as soon as applications open.',
        waitlistError:
            'Something went wrong. Please try again or email us directly.',
    },
    contact: {
        title: 'Contact',
        intro: 'Whether you are an NGO looking for someone to solve a hard problem using technology or just curious about what we do — we would love to hear from you!',
        nameLabel: 'Your name:', namePlaceholder: 'Name',
        emailLabel: 'Email:', emailPlaceholder: 'Email',
        orgLabel: 'Organization/NGO (optional):', orgPlaceholder: 'Organization or NGO name',
        messageLabel: 'Message:', messagePlaceholder: 'Message',
        sendMessage: 'Send Message',
        emailClientNote: 'This will open your email client to send the message',
        requiredNote: '* = required',
        submitting: 'Sending…',
        sendError:
            'Something went wrong sending your message. Please try again, or email us directly.',
        loadingForm: 'Loading form…',
        formUnavailable:
            'The contact form is currently unavailable. Please email us directly.',
        successFallback: 'Thanks! Your message has been sent.',
    },
    book: {
        title: 'Book a meeting',
        intro: 'Prefer to talk? Grab a slot that suits you and we will meet you there.',
        fallback: 'Online booking is not set up yet — email us and we will find a time.',
        openInNewTab: 'Open booking page',
        pickTime: 'Pick a time',
    },
    talk: {
        ngoKicker: 'For NGOs',
        ngoHeading: 'Have a problem worth solving?',
        ngoText: 'You’re an NGO and interested? Speak with us — grab a slot below and we’ll explore whether we can help.',
        studentKicker: 'For students',
        studentHeading: 'Want to make an impact?',
        studentText: 'You’re a student who’s passionate about having an impact? Whatever your background, there’s something for you at Coding for Change.',
        studentCta: 'Join the club',
    },
    sponsors: {
        title: 'Partners', subtitle: 'Our Supporters',
        intro: 'We are grateful for the support of our partners who make our work possible. Interested in becoming a partner? Reach out to us!',
        tiers: { platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze', partner: 'Partners' },
    },
    blog: {
        title: 'News', subtitle: 'Projects, lessons, and reflections from our teams',
        searchPlaceholder: 'Search posts...', all: 'All',
        noPosts: 'No posts found.', back: 'Back to Blog', notFound: 'Post not found.',
    },
    navbar: { title: 'Coding for Change', subtitle: 'Munich Student Club' },
    footer: {
        pages: 'Pages', info: 'Information',
        home: 'Home', projects: 'Projects', team: 'Team', blog: 'Blog',
        partners: 'Partners', join: 'Join', contact: 'Contact', qa: 'Q&A', ngos: 'For NGOs',
        techtour: 'Munich TechTour',
        privacy: 'Privacy', imprint: 'Imprint', cookieSettings: 'Cookie settings',
    },
    forms: {
        send: 'Send',
        submitting: 'Sending…',
        sendError:
            'Something went wrong sending the form. Please try again or email us directly.',
        required: 'required',
        successFallback: 'Thanks! We have received your submission.',
        chooseAtLeastOne: 'Choose at least one.',
        opensNewTab: 'Opens in a new tab',
        linkedUnavailable: 'This part of the form is currently unavailable. Please email us directly.',
        otherPlaceholder: 'Please specify',
        charCount: '{n} / {max} characters',
        uploadChoose: 'Choose PDF',
        uploadHint: 'PDF, max. 5 MB',
        uploading: 'Uploading…',
        uploadRemove: 'Remove',
        uploadTooLarge: 'That file is too large. The limit is 5 MB.',
        uploadWrongType: 'Please upload a PDF.',
        uploadFailed: 'The upload failed. Please try again.',
    },
    techtour: {
        statusOpen: 'Registration open',
        statusClosed: 'Registration closed',
        tbaCompany: 'Company to be announced',
        tbaTime: 'Time to be announced',
        tbaLocation: 'Location to be announced',
        tentative: 'Tentative',
        formHeading: 'Register for the TechTour',
        closedFallback:
            'Registration for this TechTour has closed. Follow us on LinkedIn to hear about the next one.',
        formUnavailable:
            'The registration form is currently unavailable. Please email us directly.',
        posterTitle: 'Munich Tech Tour',
        factFormatLabel: 'Format',
        factDatesLabel: 'When',
        factDeadlineLabel: 'Apply by',
        factEvenings: '{count} evenings · free',
        applyCta: 'Apply now',
        detailsCta: 'See the details',
        backToTour: 'Back to the line-up',
        learnMoreCta: 'Learn more',
        scrollHint: 'Scroll down to learn more',
        exploreKicker: 'The week, evening by evening',
        exploreHeading: 'What each visit looks like',
        exploreLead:
            'Come to one evening or to all of them. Every visit is hosted by the company itself — you are in their office, with the people who work there.',
        eventApplyCta: 'Apply for this evening',
        eventSiteCta: 'Company website',
        tileHint: 'Click to learn more',
        factTimeLabel: 'Time',
        factPlaceLabel: 'Where',
        draftSave: 'Save and finish later',
        draftSaved: 'Saved in this browser',
        draftRestored: 'We brought back the answers you saved here.',
        draftClear: 'Delete saved answers',
        draftCleared: 'Saved answers deleted.',
        draftNote:
            'Saving keeps your answers in this browser only – we receive nothing until you send the form.',
        stepApplyTitle: 'Apply',
        stepApplyText: 'by {date}',
        stepConfirmTitle: 'Get your place',
        stepConfirmText: 'we confirm by email',
        stepJoinTitle: 'Come along',
        stepJoinText: '{range}',
        sectionDetailsTitle: 'About you',
        attendAsk: 'Please only tick the evenings you will actually be there.',
    },
    aboutPage: {
        valuesTitle: 'What we care about',
        values: [
            { title: 'Real work, real stakes', text: 'No toy projects. Everything we build goes into production and gets used by real people.' },
            { title: 'Craft over credit', text: 'We ship things we are proud to put our names on — documented, maintainable, handed over cleanly.' },
            { title: 'Open to every discipline', text: 'Great software needs more than engineers. Product, design, comms and operations shape every project.' },
            { title: 'Impact you can point at', text: 'Success is measured by what changes for our partner and the people they serve — not by lines of code.' },
        ],
    },
    partner: {
        kicker: 'For NGOs',
        fallbackTitle: 'Have a problem worth solving? Let’s build it together.',
        fallbackLead: 'We partner with non-profits to design and ship the software they need — free of charge, delivered by a dedicated student team in a single semester.',
        talkCta: 'Start a conversation',
    },
    notFound: {
        kicker: 'Error 404',
        title: 'This page wandered off',
        lead: "The page you're looking for doesn't exist or may have moved — but there's plenty more to explore. Let's get you back on track.",
        backHome: 'Back to home',
        helpfulLinks: 'Or head somewhere useful',
        projects: 'Our projects',
        ngos: 'For NGOs',
        join: 'Join us',
    },
};

const de: Translations = {
    nav: {
        home: 'Start', events: 'Events', projects: 'Projekte',
        partners: 'Partner', team: 'Team', blog: 'Blog', qa: 'F&A', join: 'Mitmachen', contact: 'Kontakt',
        ngos: 'NGOs', techtour: 'TechTour 2026',
        applyBar: 'Bewerbungen für {round} sind offen – bis 30. Oktober',
        applyBarShort: 'Bewerbung bis 30. Okt. offen',
        applyBarCta: 'Jetzt bewerben',
    },
    common: {
        learnMore: 'Mehr erfahren', partner: 'Partner:', at: 'um',
        enterThreeD: '3D-Modus starten', exitThreeD: '3D-Modus beenden',
        unavailable: 'Inhalt nicht verfügbar.',
        close: 'Schließen',
    },
    home: {
        about: 'ÜBER UNS', events: 'EVENTS', projects: 'PROJEKTE', team: 'TEAM', join: 'MITMACHEN',
        kicker: 'Sammle Programmiererfahrung und bewirke etwas Gutes',
        ctaPrimary: 'Mitglied werden',
        ctaSecondary: 'Unsere Arbeit ansehen',
        scrollHint: '↓ zum Entdecken scrollen',
        heroLineOne: 'Tech trifft soziale Wirkung',
        heroLineTwo: 'Von Studierenden gebaut. Für Non-Profits.',
    },
    about: {
        title: 'Über Uns',
        kicker: 'Wer wir sind',
        oneLiner: 'Wir entwickeln Software für NGOs, damit sie sich auf ihre Mission konzentrieren können.',
        pitch: 'NGOs haben die Mission. Studierende haben die Fähigkeiten. Wir bringen beide zusammen.',
        stats: [
            { value: '4', label: 'NGOs unterstützt' },
            { value: '10+', label: 'Aktive Mitglieder' },
            { value: '150+', label: 'Nutzer:innen sparen Zeit' },
        ],
        howItWorks: 'So funktioniert es',
        explore: 'Entdecken',
    },
    process: {
        kicker: 'So funktioniert es',
        heading: 'Wie wir mit NGOs arbeiten',
        intro: 'Vom ersten Gespräch bis zur fertigen Software in einem einzigen Semester – diesen Weg geht jedes Projekt.',
        steps: [
            {
                timing: 'Woche 0',
                title: 'Erstgespräch',
                text: 'Erzählen Sie uns von Ihrer Organisation und dem Problem, das gelöst werden soll – ein lockeres 30-Minuten-Gespräch, kostenlos und unverbindlich.',
            },
            {
                timing: 'Woche 2',
                title: 'Klickbares Mock-up',
                text: 'Sie sehen einen ersten klickbaren Entwurf Ihres Produkts – gemeinsam passen wir ihn an, bis er zur Arbeitsweise Ihres Teams passt.',
            },
            {
                timing: 'Woche 8',
                title: 'Funktionierendes MVP',
                text: 'Die Kernfunktionen laufen mit echten Daten – Ihr Team kann die Software früh ausprobieren und mitsteuern, was am wichtigsten ist.',
            },
            {
                timing: 'Woche 12',
                title: 'Fertiges Produkt',
                text: 'Wir übergeben die fertige Software – getestet, dokumentiert und in Ihrem Besitz, mit allem, was Ihr Team für den Betrieb braucht.',
            },
        ],
    },
    cta: {
        heading: 'Bereit, etwas Großartiges zu bauen?',
        text: 'Ob Studierende:r, die:der echten Code liefern will, oder NGO mit einem Problem, das es zu lösen lohnt – sprechen Sie mit uns.',
        join: 'Mitglied werden',
        contact: 'Partner werden',
    },
    projects: {
        title: 'Projekte', subtitle: 'Technologie für das Gemeinwohl',
        intro: 'Wir bauen Software für NGOs, die wirklich etwas verändert – von Studierendenteams, gemeinsam mit unseren Partnern.',
        viewAll: 'Alle Projekte ansehen',
        more: 'Weitere Projekte',
        status: { active: 'Aktiv', completed: 'Abgeschlossen', recruiting: 'Team gesucht' },
    },
    threed: {
        kicker: 'Einfach zum Spaß',
        title: 'Lust auf die szenische Route? Probier die 3D-Seite.',
        text: 'Es gibt eine verspielte 3D-Version dieser Seite – ein kleiner Retro-Desktop, den du direkt im Browser anklicken und erkunden kannst.',
        cta: '3D-Erlebnis starten',
        backKicker: 'Du bist im 3D-Modus',
        backTitle: 'Lieber die schnelle, schlichte Version?',
        backText: 'Du erkundest gerade die 3D-Version der Seite. Wechsle jederzeit zurück zur normalen Seite – dort kommst du schneller voran.',
        backCta: 'Zurück zur normalen Seite',
    },
    projectDetail: {
        back: 'Zurück zu den Projekten', problem: 'Das Problem', approach: 'Unser Vorgehen',
        outcome: 'Was wir geliefert haben', impact: 'Wirkung', stack: 'Gebaut mit', links: 'Links',
        timeline: 'Ablauf', team: 'Das Team', partnerLabel: 'Partner',
    },
    caseStudy: {
        chooseKicker: 'Zwei Perspektiven',
        chooseTitle: 'Wie möchten Sie es lesen?',
        technicalCardTitle: 'Technischer Deep-Dive',
        technicalCardText: 'Wie wir es gebaut haben – das Problem, unser Vorgehen und der Stack. Ideal, wenn du als Studierende:r übers Mitmachen nachdenkst.',
        impactCardTitle: 'Impact-Story',
        impactCardText: 'Was ein solches Projekt für Ihre Organisation bedeuten könnte. Ideal, wenn Sie als NGO eine Partnerschaft erwägen.',
        technicalLabel: 'Technischer Deep-Dive',
        impactLabel: 'Impact-Story',
        joinHeading: 'Lust, so etwas zu bauen?',
        joinText: 'Als Mitglied baust du genau solche Software: im Team, für einen echten Partner und für Menschen, die sie jeden Tag nutzen.',
        joinButton: 'Mitglied werden',
        challengeHeading: 'Die Herausforderung',
        solutionHeading: 'Was wir gebaut haben',
        resultsHeading: 'Die Wirkung',
        workingHeading: 'Zusammenarbeit mit uns',
        workingPoints: [
            'Kostenlos – finanziert durch unsere universitäre Anbindung und unsere Partner',
            'Geliefert in einem Semester von einem festen Studierendenteam',
            'Das Ergebnis gehört Ihnen – dokumentiert, übergeben, kein Lock-in',
        ],
        partnerLink: 'So funktioniert eine Partnerschaft',
        faqHeading: 'Fragen von NGOs',
        eyebrow: 'Fallstudie',
        teamLink: 'Das ganze Team kennenlernen',
        moreProjects: 'Alle Projekte ansehen',
        bookHeading: 'Haben Sie ein ähnliches Problem?',
        bookText: 'Erzählen Sie uns davon: Buchen Sie einen Termin, und wir schauen gemeinsam, ob wir helfen können.',
        pressLabel: 'Bekannt aus',
        pressRead: 'Zum Artikel',
        stepNow: 'Aktuell',
        stepNext: 'Als Nächstes',
    },
    events: {
        title: 'Events', subtitle: 'Workshops, Hackathons & Mehr',
        intro: 'Nimm an unseren kommenden Events teil oder schau dir an, was wir bisher erlebt haben!',
        upcoming: 'Kommende Events', past: 'Vergangene Events',
        emptyTitle: 'Aktuell kein Event',
        emptyText: 'Du hast eine Idee für ein Event? Lass uns reden.',
        emptyCta: 'Kontakt aufnehmen',
    },
    team: {
        title: 'Unser Team', subtitle: 'Die Menschen hinter CFC',
        intro: 'Lernen Sie das Team kennen, das Coding for Change antreibt. Wir sind eine vielfältige Gruppe von Studierenden, die Technologie für soziale Zwecke einsetzen wollen.',
        advisersTitle: 'Beirat',
        experienceLabel: 'Zuvor bei',
        projectsLabel: 'Projekte',
        joinTileTitle: 'Dein Gesicht hier',
        joinTileHint: 'Wir wachsen — komm dazu',
        statMembers: 'Mitglieder',
        statNgos: 'NGO-Partner',
        statProjects: 'Projekte',
    },
    qa: {
        title: 'F&A', subtitle: 'Häufig Gestellte Fragen',
        intro: 'Hier finden Sie Antworten auf häufige Fragen zu Coding for Change.',
    },
    join: {
        title: 'Bau Software, die zählt',
        lead: 'Werde Teil einer Community ambitionierter Studierender, die echte Software für gemeinnützige Organisationen bauen\u00a0– und lern die Menschen und Unternehmen kennen, die Münchens Tech-Szene prägen.',
        howItWorks: 'So läuft’s ab',
        slides: {
            label: 'Momente von unseren Events',
            goTo: 'Foto {n} zeigen',
            items: {
                marioKart: {
                    caption: 'hier haben wir das CHECK24-Team im Mario-Kart-Turnier herausgefordert',
                    alt: 'Studierende feuern beim Mario-Kart-Turnier bei CHECK24 an',
                    posterAlt: 'Event-Poster: Mario-Kart-Turnier bei CHECK24',
                },
                hackathon: {
                    caption: 'hier haben wir ein Wochenende lang beim Mini-Hackathon gebaut',
                    alt: 'Mitglieder an einem langen Tisch beim Mini-Hackathon',
                },
                changemakerChat: {
                    caption: 'hier war der Ex-CEO der Welthungerhilfe bei unserem Chat zu Gast',
                    alt: 'Gesprächsrunde mit dem Ex-CEO der Welthungerhilfe im TUM Think Tank',
                    posterAlt: 'Event-Poster: Chat mit Till Wahnbaeck',
                },
            },
        },
        status: { upcoming: 'Offen ab 5. Okt.', open: 'Offen bis 30. Okt.', closed: 'Bewerbung geschlossen' },
        countdown: {
            opensIn: { one: 'morgen', other: 'in {n} Tagen' },
            closesIn: { one: 'letzter Tag', other: 'noch {n} Tage' },
        },
        cta: { upcoming: 'Benachrichtigen lassen', open: 'Jetzt bewerben', closed: 'Für die nächste Runde vormerken' },
        partnersLabel: 'Organisationen, für die wir bauen\u00a0– und Unternehmen an unserer Seite',
        expect: {
            kicker: 'Was dich erwartet',
            heading: 'Mehr als ein Nebenprojekt',
            lead: 'Ein Semester bei uns heißt: echte Software bauen, Leute kennenlernen, die du nicht mehr missen willst, und Münchens Tech-Unternehmen von innen sehen.',
            items: {
                projects: {
                    title: 'Projektarbeit',
                    text: 'Bau im kleinen Team Software für eine gemeinnützige Organisation\u00a0– vom ersten Gespräch bis zum Launch.',
                    alt: 'Mitglieder stellen dem Team der Lebenshilfe München ihre App vor',
                },
                community: {
                    title: 'Community-Events',
                    text: 'Hackathons, Talks, Socials\u00a0– und ab und zu ein Mario-Kart-Turnier.',
                    alt: 'Mitglieder an einem langen Tisch hören einem Vortrag zu',
                },
                companies: {
                    title: 'Firmenbesuche',
                    text: 'Ein Blick hinter die Kulissen von Münchens Top-Tech-Unternehmen.',
                    alt: 'Ein voller Raum mit Studierenden bei einer Präsentation von Coding for Change',
                },
            },
        },
        ways: {
            kicker: 'So bringst du dich ein',
            heading: 'Zwei Wege, etwas zu bewegen',
            items: {
                projects: {
                    label: 'Projekte',
                    title: 'Bau Software, auf die sich Menschen verlassen',
                    text: 'Im kleinen Team nimmst du dir ein echtes Problem einer gemeinnützigen Organisation vor und machst daraus ein Produkt, das jeden Tag genutzt wird.',
                    points: [
                        'Team und Projekt passend zu deinen Skills',
                        'Rund fünf Stunden pro Woche\u00a0– inklusive Team-Meeting',
                        'Bisherige Partner: Lebenshilfe, Cycling Without Age, edunovo',
                    ],
                },
                taskForce: {
                    label: 'Task Force',
                    title: 'Führ den Club wie ein Startup',
                    text: 'Hinter jedem Projekt, jedem Event und jeder Partnerschaft steht die Task Force\u00a0– die Leute, die Coding for Change möglich machen.',
                    points: [
                        'Hol Top-Tech-Unternehmen an Bord und organisiere Hackathons',
                        'Finde NGOs und die Probleme, die sich zu lösen lohnen',
                        'Verantworte Recht und Finanzen eines eingetragenen Vereins',
                    ],
                },
            },
            contactLabel: 'Fragen? Melde dich!',
            contactLink: '{name} auf LinkedIn',
        },
        process: { kicker: 'Bewerbung', heading: 'In drei Schritten zum ersten Projekt' },
        showcase: {
            kicker: 'Was du bauen kannst',
            forNgo: 'für {ngo}',
            link: 'Zur Case Study',
            alt: '{title} auf Laptop und Handy',
        },
        steps: {
            apply: {
                timing: '5.–30. Okt. 2026',
                title: 'Bewerben',
                text: 'Ein paar Fragen zu dir und dein Lebenslauf.',
            },
            interview: {
                timing: '2.–8. Nov. 2026',
                title: 'Interview',
                text: 'Ein Gespräch und eine kleine praktische Challenge.',
            },
            admission: {
                timing: '9.–11. Nov. 2026',
                title: 'Du bist dabei',
                text: 'Lern beim New-Joiner-Event die anderen kennen und finde dein Team.',
            },
        },
        stepNow: 'Jetzt',
        closing: {
            heading: 'Dein erstes Projekt beginnt hier',
            text: {
                upcoming: 'Die Bewerbung startet am 5. Oktober. Trag dich ein\u00a0– wir sagen dir Bescheid, sobald das Formular online ist.',
                open: 'Bewerbungsschluss ist der 30. Oktober um 23:59 Uhr.',
                closed: 'Diese Runde ist vorbei. Trag dich ein und erfahre als Erste:r, wenn die Bewerbung wieder öffnet.',
            },
        },
        apply: {
            back: 'Alles zum Mitmachen',
            title: 'Bewirb dich für {round}',
            lead: {
                upcoming: 'Das Formular öffnet am 5. Oktober.',
                open: 'Nimm dir Zeit für deine Antworten\u00a0– und halte deinen Lebenslauf als PDF bereit.',
                closed: 'Die Bewerbung für diese Runde ist geschlossen.',
            },
            contact: 'Fragen zur Bewerbung? Schreib uns an {email}.',
            sectionAbout: 'Über dich',
            sectionApplication: 'Deine Bewerbung',
            draftNote:
                'Deine Antworten werden automatisch in diesem Browser gespeichert, du kannst also später weitermachen – bei uns kommt nichts an, bevor du das Formular abschickst.',
        },
        loadingForm: 'Formular wird geladen…',
        formUnavailable:
            'Das Bewerbungsformular ist derzeit nicht verfügbar. Bitte schreib uns direkt.',
        waitlistTitle: 'Bewerbungen sind derzeit geschlossen',
        waitlistLead:
            'Trag dich ein und erfahre als Erste:r, wenn die Bewerbungen wieder öffnen\u00a0– wir schreiben dir sofort, sobald es so weit ist.',
        upcomingTitle: 'Bewerbungen sind ab 5. Oktober möglich',
        upcomingLead:
            'Trag dich ein\u00a0– wir sagen dir Bescheid, sobald das Formular online ist.',
        waitlistEmailLabel: 'E-Mail:',
        waitlistEmailPlaceholder: 'du@beispiel.de',
        waitlistButton: 'Benachrichtigt mich',
        waitlistSubmitting: 'Wird eingetragen…',
        waitlistSuccess:
            'Du stehst auf der Liste! Wir schreiben dir, sobald die Bewerbung öffnet.',
        waitlistError:
            'Etwas ist schiefgelaufen. Bitte versuche es erneut oder schreib uns direkt.',
    },
    contact: {
        title: 'Kontakt',
        intro: 'Ob NGO auf der Suche nach jemandem, der ein kniffliges Problem mithilfe von Technologie löst, oder einfach neugierig auf unsere Arbeit – wir freuen uns, von Ihnen zu hören!',
        nameLabel: 'Ihr Name:', namePlaceholder: 'Name',
        emailLabel: 'E-Mail:', emailPlaceholder: 'E-Mail',
        orgLabel: 'Organisation/NGO (optional):', orgPlaceholder: 'Name der Organisation oder NGO',
        messageLabel: 'Nachricht:', messagePlaceholder: 'Nachricht',
        sendMessage: 'Nachricht senden',
        emailClientNote: 'Damit wird Ihr E-Mail-Programm geöffnet, um die Nachricht zu senden',
        requiredNote: '* = Pflichtfeld',
        submitting: 'Wird gesendet…',
        sendError:
            'Beim Senden Ihrer Nachricht ist etwas schiefgelaufen. Bitte versuchen Sie es erneut oder schreiben Sie uns direkt eine E-Mail.',
        loadingForm: 'Formular wird geladen…',
        formUnavailable:
            'Das Kontaktformular ist derzeit nicht verfügbar. Bitte schreiben Sie uns direkt eine E-Mail.',
        successFallback: 'Danke! Ihre Nachricht wurde gesendet.',
    },
    book: {
        title: 'Termin buchen',
        intro: 'Lieber sprechen? Wählen Sie einen passenden Slot und wir treffen uns dort.',
        fallback: 'Online-Buchung ist noch nicht eingerichtet — schreiben Sie uns und wir finden einen Termin.',
        openInNewTab: 'Buchungsseite öffnen',
        pickTime: 'Termin wählen',
    },
    talk: {
        ngoKicker: 'Für NGOs',
        ngoHeading: 'Ein Problem, das es zu lösen lohnt?',
        ngoText: 'Sie sind eine NGO und interessiert? Sprechen Sie mit uns – buchen Sie unten einen Termin und wir schauen, ob wir helfen können.',
        studentKicker: 'Für Studierende',
        studentHeading: 'Willst du etwas bewegen?',
        studentText: 'Du bist Studierende:r und brennst dafür, etwas zu bewirken? Egal welcher Hintergrund – bei Coding for Change ist etwas für dich dabei.',
        studentCta: 'Mitglied werden',
    },
    sponsors: {
        title: 'Partner', subtitle: 'Unsere Unterstützer',
        intro: 'Wir sind dankbar für die Unterstützung unserer Partner, die unsere Arbeit erst möglich machen. Interesse an einer Partnerschaft? Melden Sie sich bei uns!',
        tiers: { platinum: 'Platin', gold: 'Gold', silver: 'Silber', bronze: 'Bronze', partner: 'Partner' },
    },
    blog: {
        title: 'News', subtitle: 'Projekte, Erkenntnisse und Rückblicke unserer Teams',
        searchPlaceholder: 'Beiträge durchsuchen...', all: 'Alle',
        noPosts: 'Keine Beiträge gefunden.', back: 'Zurück zum Blog', notFound: 'Beitrag nicht gefunden.',
    },
    navbar: { title: 'Coding for Change', subtitle: 'Münchner Studierendenclub' },
    footer: {
        pages: 'Seiten', info: 'Informationen',
        home: 'Startseite', projects: 'Projekte', team: 'Team', blog: 'Blog',
        partners: 'Partner', join: 'Mitmachen', contact: 'Kontakt', qa: 'F&A', ngos: 'Für NGOs',
        techtour: 'Munich TechTour',
        privacy: 'Datenschutz', imprint: 'Impressum', cookieSettings: 'Cookie-Einstellungen',
    },
    forms: {
        send: 'Absenden',
        submitting: 'Wird gesendet…',
        sendError:
            'Beim Senden ist etwas schiefgelaufen. Bitte versuche es erneut oder schreib uns direkt.',
        required: 'Pflichtfeld',
        successFallback: 'Danke! Wir haben deine Angaben erhalten.',
        chooseAtLeastOne: 'Bitte wähle mindestens eine Option.',
        opensNewTab: 'Öffnet in neuem Tab',
        linkedUnavailable: 'Dieser Teil des Formulars ist derzeit nicht verfügbar. Bitte schreib uns direkt.',
        otherPlaceholder: 'Bitte angeben',
        charCount: '{n} / {max} Zeichen',
        uploadChoose: 'PDF auswählen',
        uploadHint: 'PDF, max. 5 MB',
        uploading: 'Wird hochgeladen…',
        uploadRemove: 'Entfernen',
        uploadTooLarge: 'Die Datei ist zu groß. Das Limit sind 5 MB.',
        uploadWrongType: 'Bitte lade ein PDF hoch.',
        uploadFailed: 'Der Upload ist fehlgeschlagen. Bitte versuche es erneut.',
    },
    techtour: {
        statusOpen: 'Anmeldung offen',
        statusClosed: 'Anmeldung geschlossen',
        tbaCompany: 'Unternehmen wird noch bekannt gegeben',
        tbaTime: 'Uhrzeit wird noch bekannt gegeben',
        tbaLocation: 'Ort wird noch bekannt gegeben',
        tentative: 'Vorläufig',
        formHeading: 'Für die TechTour anmelden',
        closedFallback:
            'Die Anmeldung für diese TechTour ist geschlossen. Folg uns auf LinkedIn, um von der nächsten zu erfahren.',
        formUnavailable:
            'Das Anmeldeformular ist derzeit nicht verfügbar. Bitte schreib uns direkt.',
        posterTitle: 'Munich Tech Tour',
        factFormatLabel: 'Format',
        factDatesLabel: 'Wann',
        factDeadlineLabel: 'Bewerbung bis',
        factEvenings: '{count} Abende · kostenlos',
        applyCta: 'Jetzt bewerben',
        detailsCta: 'Details ansehen',
        backToTour: 'Zurück zum Line-up',
        learnMoreCta: 'Mehr erfahren',
        scrollHint: 'Runterscrollen für Details',
        exploreKicker: 'Die Woche, Abend für Abend',
        exploreHeading: 'Was bei den Besuchen passiert',
        exploreLead:
            'Komm zu einem Abend oder zu allen. Jeder Besuch wird vom Unternehmen selbst ausgerichtet — du bist in deren Büro, bei den Leuten, die dort arbeiten.',
        eventApplyCta: 'Für diesen Abend bewerben',
        eventSiteCta: 'Zur Website',
        tileHint: 'Klicken für Details',
        factTimeLabel: 'Uhrzeit',
        factPlaceLabel: 'Ort',
        draftSave: 'Speichern und später weitermachen',
        draftSaved: 'In diesem Browser gespeichert',
        draftRestored: 'Wir haben deine hier gespeicherten Antworten zurückgeholt.',
        draftClear: 'Gespeicherte Antworten löschen',
        draftCleared: 'Gespeicherte Antworten gelöscht.',
        draftNote:
            'Das Speichern legt deine Antworten nur in diesem Browser ab – bei uns kommt nichts an, bevor du das Formular abschickst.',
        stepApplyTitle: 'Bewerben',
        stepApplyText: 'bis {date}',
        stepConfirmTitle: 'Zusage bekommen',
        stepConfirmText: 'Antwort per E-Mail',
        stepJoinTitle: 'Dabei sein',
        stepJoinText: '{range}',
        sectionDetailsTitle: 'Über dich',
        attendAsk: 'Bitte kreuz nur die Abende an, an denen du wirklich dabei bist.',
    },
    aboutPage: {
        valuesTitle: 'Worauf es uns ankommt',
        values: [
            { title: 'Echte Arbeit, echte Verantwortung', text: 'Keine Spielprojekte. Alles, was wir bauen, geht in Produktion und wird von echten Menschen genutzt.' },
            { title: 'Handwerk vor Anerkennung', text: 'Wir liefern Dinge, auf die wir stolz sind – dokumentiert, wartbar, sauber übergeben.' },
            { title: 'Offen für jede Disziplin', text: 'Gute Software braucht mehr als Entwickler:innen. Produkt, Design, Kommunikation und Operations prägen jedes Projekt.' },
            { title: 'Wirkung, auf die man zeigen kann', text: 'Erfolg misst sich daran, was sich für unsere Partner und die Menschen, die sie erreichen, verändert – nicht an Codezeilen.' },
        ],
    },
    partner: {
        kicker: 'Für NGOs',
        fallbackTitle: 'Ein Problem, das es zu lösen lohnt? Lass es uns gemeinsam bauen.',
        fallbackLead: 'Wir entwickeln gemeinsam mit gemeinnützigen Organisationen die Software, die sie brauchen – kostenlos, geliefert von einem festen Studierendenteam in einem einzigen Semester.',
        talkCta: 'Gespräch starten',
    },
    notFound: {
        kicker: 'Fehler 404',
        title: 'Diese Seite ist abhandengekommen',
        lead: 'Die gesuchte Seite existiert nicht oder wurde verschoben — es gibt aber noch viel zu entdecken. Wir bringen Sie zurück auf den richtigen Weg.',
        backHome: 'Zurück zur Startseite',
        helpfulLinks: 'Oder gehen Sie direkt weiter',
        projects: 'Unsere Projekte',
        ngos: 'Für NGOs',
        join: 'Mitmachen',
    },
};

export const translations: Record<Locale, Translations> = { en, de };
