import type { ApplicationStepId } from '../lib/applicationPhase';

export type Locale = 'en' | 'de';

export interface Translations {
    nav: {
        home: string; events: string; projects: string;
        partners: string; team: string; blog: string; qa: string; join: string; contact: string;
        ngos: string; techtour: string;
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
    join: {
        benefits: string; requirements: string; waysToContribute: string; applyNow: string;
        nameLabel: string; namePlaceholder: string;
        emailLabel: string; emailPlaceholder: string;
        motivationLabel: string; motivationPlaceholder: string;
        sendApplication: string; unavailable: string;
        submitting: string; sendError: string; loadingForm: string;
        formUnavailable: string; successFallback: string; requiredNote: string;
        waitlistTitle: string; waitlistLead: string;
        waitlistEmailLabel: string; waitlistEmailPlaceholder: string;
        waitlistButton: string; waitlistSubmitting: string;
        waitlistSuccess: string; waitlistError: string;
        /** Status pill in the page head. `{n}` in daysLeft is the day count. */
        statusOpen: string; statusClosed: string; statusDeadline: string;
        daysLeft: string; lastDay: string;
        /** Top-of-page button that scrolls to the application form. */
        toForm: string;
        /** "How the application works" — the dated steps of the current round. */
        phase: {
            kicker: string; heading: string; intro: string;
            steps: Record<ApplicationStepId, { timing: string; title: string; text: string }>;
        };
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
        benefits: 'What you get', requirements: 'Who we’re looking for',
        waysToContribute: 'Ways to contribute', applyNow: 'Apply Now',
        nameLabel: 'Your Name:', namePlaceholder: 'Name',
        emailLabel: 'Email:', emailPlaceholder: 'Email',
        motivationLabel: 'Why do you want to join?',
        motivationPlaceholder: 'Tell us about your motivation...',
        sendApplication: 'Send Application', unavailable: 'Content unavailable.',
        submitting: 'Sending…',
        sendError:
            'Something went wrong sending your application. Please try again or email us directly.',
        loadingForm: 'Loading form…',
        formUnavailable:
            'The application form is currently unavailable. Please email us directly.',
        successFallback: 'Thanks! Your application has been sent.',
        requiredNote: '* = required',
        waitlistTitle: 'Applications are currently closed',
        waitlistLead:
            'Sign up to be the first to know when applications reopen — we’ll email you the moment they do.',
        waitlistEmailLabel: 'Email:',
        waitlistEmailPlaceholder: 'you@example.com',
        waitlistButton: 'Notify me',
        waitlistSubmitting: 'Signing up…',
        waitlistSuccess:
            'You’re on the list! We’ll be in touch as soon as applications reopen.',
        waitlistError:
            'Something went wrong. Please try again or email us directly.',
        statusOpen: 'Applications open',
        statusClosed: 'Applications closed',
        statusDeadline: 'Deadline 30 Oct 2026, 23:59',
        daysLeft: '{n} days left',
        lastDay: 'Last day to apply',
        toForm: 'To the application form',
        phase: {
            kicker: 'Application phase · Winter 2026/27',
            heading: 'How the application works',
            intro: 'Seven steps from a first hello to your first pull request. Every date that matters for this round, in order.',
            steps: {
                fair: {
                    timing: '21 Oct 2026 · 10:00–17:00',
                    title: 'Student Club Fair',
                    text: 'Come by our booth and meet the team. Ask us anything about the projects, the time commitment and what a semester with us looks like.',
                },
                apply: {
                    timing: 'Deadline 30 Oct 2026, 23:59',
                    title: 'Send your application',
                    text: 'The form below takes five minutes: your e-mail, why you want to join, and a yes to about five hours a week.',
                },
                invitation: {
                    timing: 'By 1 Nov 2026',
                    title: 'Interview invitation',
                    text: 'Within two days of the deadline you hear from us and pick an interview slot that works for you.',
                },
                interviews: {
                    timing: '2–8 Nov 2026',
                    title: 'Interviews',
                    text: 'A relaxed conversation about you, your motivation and where you would fit best.',
                },
                onboarding: {
                    timing: '9–11 Nov 2026',
                    title: 'Onboarding event',
                    text: 'We introduce this round’s projects and partner NGOs, then match you to a project and team based on your interests and skills. You also get your accounts and tools. We will confirm the exact date with your acceptance.',
                },
                firstMeeting: {
                    timing: 'Mid-Nov 2026',
                    title: 'First team meeting',
                    text: 'Your new team meets for the first time: goals, roles and the first tasks. From then on you meet every week.',
                },
                project: {
                    timing: 'Mid-Nov 2026 – mid-Jan 2027',
                    title: 'Project phase',
                    text: 'Two months of building for a real non-profit. Plan on about five hours a week including a one-hour team meeting, and at least one pull request per week.',
                },
            },
        },
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
            'Saving keeps your answers in this browser only — we receive nothing until you send the form.',
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
        back: 'Zurück zu Projekten', problem: 'Das Problem', approach: 'Unser Vorgehen',
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
        joinHeading: 'Willst du sowas bauen?',
        joinText: 'Genau solche echte, ausgelieferte Software baust du als Mitglied – im Team, mit echtem Partner und Menschen, die darauf angewiesen sind.',
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
        teamLink: 'Das ganze Team ansehen',
        moreProjects: 'Alle Projekte ansehen',
        bookHeading: 'Ein Problem, das es zu lösen lohnt?',
        bookText: 'Erzählen Sie uns davon – wählen Sie einen Termin und wir schauen, ob wir helfen können.',
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
        benefits: 'Was du bekommst', requirements: 'Wen wir suchen',
        waysToContribute: 'Wie du mitwirken kannst', applyNow: 'Jetzt bewerben',
        nameLabel: 'Dein Name:', namePlaceholder: 'Name',
        emailLabel: 'E-Mail:', emailPlaceholder: 'E-Mail',
        motivationLabel: 'Warum möchtest du mitmachen?',
        motivationPlaceholder: 'Erzähl uns von deiner Motivation...',
        sendApplication: 'Bewerbung absenden', unavailable: 'Inhalt nicht verfügbar.',
        submitting: 'Wird gesendet…',
        sendError:
            'Beim Senden deiner Bewerbung ist etwas schiefgelaufen. Bitte versuche es erneut oder schreib uns direkt.',
        loadingForm: 'Formular wird geladen…',
        formUnavailable:
            'Das Bewerbungsformular ist derzeit nicht verfügbar. Bitte schreib uns direkt.',
        successFallback: 'Danke! Deine Bewerbung wurde gesendet.',
        requiredNote: '* = Pflichtfeld',
        waitlistTitle: 'Bewerbungen sind derzeit geschlossen',
        waitlistLead:
            'Trag dich ein und erfahre als Erste:r, wenn die Bewerbungen wieder öffnen – wir schreiben dir sofort, sobald es so weit ist.',
        waitlistEmailLabel: 'E-Mail:',
        waitlistEmailPlaceholder: 'du@beispiel.de',
        waitlistButton: 'Benachrichtigt mich',
        waitlistSubmitting: 'Wird eingetragen…',
        waitlistSuccess:
            'Du stehst auf der Liste! Wir melden uns, sobald die Bewerbungen wieder öffnen.',
        waitlistError:
            'Etwas ist schiefgelaufen. Bitte versuche es erneut oder schreib uns direkt.',
        statusOpen: 'Bewerbungen offen',
        statusClosed: 'Bewerbungen geschlossen',
        statusDeadline: 'Frist 30. Okt. 2026, 23:59 Uhr',
        daysLeft: 'noch {n} Tage',
        lastDay: 'Letzter Tag zum Bewerben',
        toForm: 'Zum Bewerbungsformular',
        phase: {
            kicker: 'Bewerbungsphase · Winter 2026/27',
            heading: 'So läuft die Bewerbung ab',
            intro: 'Sieben Schritte vom ersten Hallo bis zu deinem ersten Pull Request. Alle Termine dieser Runde, der Reihe nach.',
            steps: {
                fair: {
                    timing: '21. Okt. 2026 · 10–17 Uhr',
                    title: 'Student Club Fair',
                    text: 'Komm an unserem Stand vorbei und lern das Team kennen. Frag uns alles zu den Projekten, zum Zeitaufwand und dazu, wie ein Semester bei uns aussieht.',
                },
                apply: {
                    timing: 'Frist 30. Okt. 2026, 23:59 Uhr',
                    title: 'Bewerbung abschicken',
                    text: 'Das Formular unten dauert fünf Minuten: deine E-Mail, warum du mitmachen willst und ein Ja zu etwa fünf Stunden pro Woche.',
                },
                invitation: {
                    timing: 'Bis 1. Nov. 2026',
                    title: 'Einladung zum Interview',
                    text: 'Innerhalb von zwei Tagen nach der Frist hörst du von uns und wählst einen Interviewtermin, der dir passt.',
                },
                interviews: {
                    timing: '2.–8. Nov. 2026',
                    title: 'Interviews',
                    text: 'Ein lockeres Gespräch über dich, deine Motivation und wo du am besten hinpasst.',
                },
                onboarding: {
                    timing: '9.–11. Nov. 2026',
                    title: 'Onboarding-Event',
                    text: 'Wir stellen die Projekte und Partner-NGOs dieser Runde vor und matchen dich anhand deiner Interessen und Fähigkeiten mit einem Projekt und Team. Außerdem bekommst du deine Zugänge und Tools. Den genauen Termin bestätigen wir dir mit der Zusage.',
                },
                firstMeeting: {
                    timing: 'Mitte Nov. 2026',
                    title: 'Erstes Team-Meeting',
                    text: 'Dein neues Team trifft sich zum ersten Mal: Ziele, Rollen und die ersten Aufgaben. Ab dann trefft ihr euch jede Woche.',
                },
                project: {
                    timing: 'Mitte Nov. 2026 – Mitte Jan. 2027',
                    title: 'Projektphase',
                    text: 'Zwei Monate bauen für eine echte Non-Profit-Organisation. Rechne mit etwa fünf Stunden pro Woche inklusive einem einstündigen Team-Meeting und mindestens einem Pull Request pro Woche.',
                },
            },
        },
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
            'Das Speichern legt deine Antworten nur in diesem Browser ab — bei uns kommt nichts an, bevor du das Formular abschickst.',
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
