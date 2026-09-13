/**
 * Development seed — fills the CMS with representative sample content in both
 * English and German so the site can be reviewed in a fully localised state.
 *
 * It talks to the running CMS over its REST API, so it needs the CMS to be
 * up. Run it inside the Docker stack:
 *
 *   docker compose exec cms pnpm seed
 *
 * Plain JavaScript on purpose: it runs with bare `node`, with no TypeScript
 * transpilation or bundler.
 *
 * It is safe to rerun: if content already exists the script does nothing.
 * To reseed from scratch, recreate the database volume
 * (`docker compose down -v`) and run it again.
 */

import { upsertForms } from './lib/upsertForms.mjs';

const BASE = (process.env.SEED_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@codingforchange.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe!1234';

// ─── English content ────────────────────────────────────────────────────────

const siteConfig = {
  clubName: 'Coding for Change',
  tagline:
    "We build the software nonprofits can't afford to build themselves — free, in a single semester.",
  description:
    'Coding for Change is a student initiative at the Technical University ' +
    'of Munich. We build software for non-profits, host hackathons, and ' +
    'bring students together to use code for social good. Every project ' +
    'pairs student developers with a real NGO client and ships within a ' +
    'semester.',
  email: 'team@codingforchange.com',
  socialLinks: [
    { platform: 'LinkedIn', url: 'https://www.linkedin.com/company/coding-for-change/' },
    { platform: 'GitHub', url: 'https://github.com/coding-for-change' },
    { platform: 'Instagram', url: 'https://www.instagram.com/codingforchange/' },
  ],
  copyrightText: '© 2026 Coding for Change',
  windowTitle: 'Coding for Change',
  stats: [
    { value: '4', label: 'NGOs partnered' },
    { value: '10+', label: 'Active members' },
    { value: '150+', label: "Users' time saved" },
  ],
};

// "Partner with us / For NGOs" page (global `partner`).
const partner = {
  title: "Have a problem worth solving? Let's build it together.",
  intro:
    'We partner with non-profits to design and ship the software they need — free of charge, ' +
    'delivered by a dedicated student team over a single semester. No lock-in, no invoice: ' +
    'you own what we build.',
  valueProps: [
    { title: 'A dedicated team', description: 'Engineers, product and design working only on your project for the semester.' },
    { title: 'Production software, not a prototype', description: 'Real, maintainable software that goes live and keeps working after we hand it over.' },
    { title: 'Free of charge', description: 'Funded by our university backing and sponsors — there is no cost to you.' },
    { title: 'Clean hand-off', description: 'Documentation, a walkthrough, and the code — you own it, with no dependency on us.' },
  ],
  process: [
    { title: 'Tell us the problem', description: 'A first conversation to understand your work and the pain point worth solving.' },
    { title: 'We scope it together', description: 'We shape a solution that can realistically ship in one semester.' },
    { title: 'The team builds', description: 'A student team builds it in agile sprints, with you in the loop throughout.' },
    { title: 'Hand-off & support', description: 'We deliver the finished product with docs and a support window.' },
  ],
  commitment:
    'All we ask: a main point of contact and a little of their time through the semester, so we build the right thing.',
  ctaHeading: 'Ready to talk?',
  ctaText:
    "Tell us about your organisation and the problem you're facing — we'll take it from there.",
  contactEmail: 'info@codingforchange.com',
};

const membership = {
  title: 'Become a Member',
  description:
    "We're a cross-disciplinary community of students building real software " +
    'for non-profits — and that takes more than engineers. It takes people who ' +
    'talk to partners and find the real problem, people who tell our story, and ' +
    "people who grow the team. Whatever you're studying, there's a way to make " +
    'a real impact with us.',
  benefits: [
    { text: 'Ship real work for a real non-profit client' },
    { text: 'Learn from experienced leads and grow job-ready skills' },
    { text: 'Build a portfolio of high-impact projects' },
    { text: "Connect with Munich's tech and social-impact community" },
    { text: 'Workshops, hackathons, and socials throughout the semester' },
  ],
  requirements: [
    { text: "You're studying or working in Germany" },
    { text: 'You can commit around 5 hours a week during the semester' },
    {
      text:
        'You care about social impact — coding experience is welcome but not ' +
        'required for every role',
    },
  ],
  tracks: [
    {
      title: 'Engineering',
      description:
        "Design and build the software that solves our partners' problems — " +
        'frontend, backend, and everything in between. All experience levels welcome.',
    },
    {
      title: 'Consulting & Product',
      description:
        'Work directly with our non-profit partners to uncover the real problem, ' +
        'scope the solution, and translate it for the engineering team. A great ' +
        'fit for business, management, and product-minded students.',
    },
    {
      title: 'Marketing & Communications',
      description:
        'Grow our reach and tell the story of our impact — social media, content, ' +
        'events, and partnerships.',
    },
    {
      title: 'People & Operations',
      description:
        'Recruit, onboard, and support our members, and keep the club running as ' +
        'we grow. The organisational backbone of Coding for Change.',
    },
  ],
  contactEmail: 'join@codingforchange.com',
};

const team = [
  {
    name: 'Lena Hofmann',
    role: 'President',
    bio: "Computer science master's student who founded Coding for Change after a semester volunteering with a local NGO. Keeps the teams aligned and the coffee flowing.",
    links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/' }],
  },
  {
    name: 'Jonas Weber',
    role: 'Vice President',
    bio: 'Backend developer focused on partnerships. Spends his time making sure every NGO gets a project team that fits their needs.',
    links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/' }],
  },
  {
    name: 'Aisha Khan',
    role: 'Project Lead',
    bio: 'Full-stack developer who has led three NGO projects from kickoff to handoff. Passionate about mentoring first-time contributors.',
    links: [{ label: 'GitHub', url: 'https://github.com/' }],
  },
  {
    name: 'Maximilian Bauer',
    role: 'Treasurer',
    bio: "Information systems student keeping the club's finances and grant applications in order so the teams can focus on building.",
    links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/' }],
  },
  {
    name: 'Sofia Rossi',
    role: 'Design Lead',
    bio: 'Designer and front-end developer making sure the software we hand to partners is as usable as it is functional.',
    links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/' }],
  },
  {
    name: 'David Müller',
    role: 'Outreach Lead',
    bio: 'Runs hackathons, workshops, and the partner pipeline. If Coding for Change is at an event in Munich, David organised it.',
    links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/' }],
  },
];

const projects = [
  {
    title: 'Volunteer Portal',
    ngoPartner: 'Münchner Tafel',
    slug: 'volunteer-portal',
    featured: true,
    description:
      'A web portal for coordinating volunteer shifts and food-bank logistics, replacing a tangle of spreadsheets and phone calls.',
    technologies: [{ name: 'React' }, { name: 'Node.js' }, { name: 'PostgreSQL' }],
    status: 'completed',
    links: [{ label: 'Repository', url: 'https://github.com/coding-for-change' }],
    impact: 'Coordinates 200+ volunteer shifts a week — hours of admin turned into a few clicks.',
    problem:
      'Münchner Tafel coordinated hundreds of volunteer shifts every week using spreadsheets and phone calls. Staff spent hours reconciling schedules, and volunteers often turned up to the wrong location.',
    approach:
      'A student team built a web portal with a React frontend and a Node.js / PostgreSQL backend, designed around the real daily workflow. Volunteers see upcoming shifts and sign up in seconds; staff get a live dashboard of coverage across locations.',
    outcome:
      'The portal replaced the spreadsheet-and-phone process entirely. Volunteers self-serve their shifts, no-shows dropped, and the coordination team got hours of their week back.',
    quote: {
      text: 'For the first time we can see our whole week of shifts at a glance. It has taken a huge weight off the team.',
      author: 'Coordinator',
      role: 'Münchner Tafel',
    },
    impactHeadline: 'How Münchner Tafel gave its coordinators their week back',
    impactChallenge:
      'Every week, Münchner Tafel relies on hundreds of volunteers to move food to the people who need it. Keeping track of who was coming, and when, meant a tangle of spreadsheets and phone calls — and volunteers still turned up at the wrong place.',
    impactSolution:
      'We built a simple portal where volunteers see the week ahead and sign up in a couple of taps, while coordinators get a live picture of who is covering what. No training required — it works the way the team already thinks about their week.',
    impactResults:
      'The spreadsheets and phone-tag are gone. Volunteers organise themselves, no-shows dropped, and the coordination team got hours of their week back to spend on the mission instead of the rota.',
    ngoFaq: [
      { question: 'What does it cost us?', answer: 'Nothing. Our work is funded by our university backing and sponsors — there is no cost to your organisation.' },
      { question: 'How long does it take?', answer: 'A single semester, from first conversation to a working product handed over to your team.' },
      { question: 'What happens after hand-off?', answer: 'You own it — the code, the documentation and a walkthrough — with a support window afterwards. No lock-in.' },
    ],
  },
  {
    title: 'Donation Tracker',
    ngoPartner: 'Lebenshilfe München',
    description:
      'A dashboard that gives the fundraising team a live view of donations, recurring givers, and campaign performance.',
    technologies: [{ name: 'Next.js' }, { name: 'TypeScript' }, { name: 'Prisma' }],
    status: 'active',
    links: [],
  },
  {
    title: 'Mentorship Matching Platform',
    ngoPartner: 'Start with a Friend',
    description:
      'An algorithm-assisted tool that pairs newcomers with local mentors based on language, interests, and availability.',
    technologies: [{ name: 'React' }, { name: 'Python' }, { name: 'FastAPI' }],
    status: 'active',
    links: [],
  },
  {
    title: 'Impact Dashboard',
    ngoPartner: 'Green City e.V.',
    description:
      "A public dashboard visualising the environmental impact of the organisation's urban greening projects across Munich.",
    technologies: [{ name: 'Vue' }, { name: 'D3.js' }],
    status: 'recruiting',
    links: [],
  },
  {
    title: 'Event Management Tool',
    ngoPartner: 'Caritas München',
    description:
      'An internal tool for scheduling community events, tracking attendance, and sending reminders to participants.',
    technologies: [{ name: 'React' }, { name: 'Express' }, { name: 'MongoDB' }],
    status: 'completed',
    links: [{ label: 'Repository', url: 'https://github.com/coding-for-change' }],
  },
];

const events = [
  {
    title: 'Semester Kickoff',
    date: 'April 15, 2026',
    time: '18:00',
    location: 'TUM Main Campus, Room 1100',
    description:
      "Meet the teams, hear about this semester's NGO projects, and find out how to get involved. Pizza provided.",
    type: 'Info-session',
    isUpcoming: true,
  },
  {
    title: 'Code for Good Hackathon',
    date: 'May 23–24, 2026',
    time: '09:00',
    location: 'TUM Garching, Informatics Building',
    description:
      'A 24-hour hackathon where student teams build prototypes for real challenges submitted by Munich non-profits.',
    type: 'Hackathon',
    isUpcoming: true,
    link: { label: 'Register', url: 'https://codingforchange.com/events' },
  },
  {
    title: 'Intro to React Workshop',
    date: 'May 8, 2026',
    time: '17:00',
    location: 'Online',
    description:
      'A hands-on beginner workshop covering components, state, and hooks — everything you need for your first project team.',
    type: 'Workshop',
    isUpcoming: true,
  },
  {
    title: 'End-of-Semester Social',
    date: 'July 18, 2026',
    time: '19:00',
    location: 'Munich City Centre',
    description:
      'Celebrate the projects we shipped this semester with the teams and our partner organisations.',
    type: 'Social',
    isUpcoming: true,
  },
  {
    title: 'Winter Hackathon 2025',
    date: 'December 6, 2025',
    time: '10:00',
    location: 'TUM Garching',
    description:
      'Our winter hackathon produced four NGO prototypes, two of which became full project teams this semester.',
    type: 'Hackathon',
    isUpcoming: false,
  },
  {
    title: 'Git & GitHub Workshop',
    date: 'November 12, 2025',
    time: '17:00',
    location: 'TUM Main Campus',
    description: 'An introduction to version control and collaboration workflows for new members.',
    type: 'Workshop',
    isUpcoming: false,
  },
];

const faqs = [
  {
    question: 'Do I need prior experience to join?',
    answer:
      'No. We onboard members of all levels and pair newcomers with experienced leads. Curiosity and commitment matter more than a polished CV.',
    category: 'general',
  },
  {
    question: 'How much time does membership require?',
    answer:
      'Plan for around 4–6 hours per week during the semester. Project teams set their own schedules around your studies.',
    category: 'membership',
  },
  {
    question: 'Is there a membership fee?',
    answer: 'No. Coding for Change is free to join — we are funded by sponsors and university support.',
    category: 'membership',
  },
  {
    question: 'How are projects chosen?',
    answer:
      'We scope projects with NGO partners that can be delivered within a semester, then match each one with a student team based on skills and interest.',
    category: 'projects',
  },
  {
    question: 'Can my organisation request a project?',
    answer:
      'Yes. Non-profits can reach out through our contact form. We work pro bono with mission-aligned organisations.',
    category: 'projects',
  },
  {
    question: 'What technologies do you use?',
    answer:
      "It depends on the project, but most teams work with React, TypeScript, and Node.js. We choose the stack that best fits the partner's needs.",
    category: 'technical',
  },
  {
    question: 'Do I need to study computer science?',
    answer:
      'Not at all. We welcome students from any programme — designers, product-minded students, and developers all have a place here.',
    category: 'general',
  },
];

const sponsors = [
  {
    name: 'Technical University of Munich',
    tier: 'partner',
    url: 'https://www.tum.de/',
    description: 'Our home university, providing space, accreditation, and a community of students to draw on.',
  },
  {
    name: 'UnternehmerTUM',
    tier: 'gold',
    url: 'https://www.unternehmertum.de/',
    description: "Munich's centre for innovation and entrepreneurship, supporting our hackathons and events.",
  },
  {
    name: 'GitHub Education',
    tier: 'silver',
    url: 'https://education.github.com/',
    description: 'Provides tooling and resources that keep our project teams shipping.',
  },
  {
    name: 'Munich Tech Collective',
    tier: 'bronze',
    url: 'https://codingforchange.com/sponsors',
    description: 'A local network connecting student initiatives with mentors.',
  },
  {
    name: 'Code Foundation e.V.',
    tier: 'bronze',
    url: 'https://codingforchange.com/sponsors',
    description: 'Backs grassroots tech-for-good work across Germany.',
  },
];

// ─── German translations (localized fields only) ────────────────────────────

const siteConfigDe = {
  tagline:
    'Wir entwickeln die Software, die sich gemeinnützige Organisationen sonst nicht leisten können – kostenlos, in einem einzigen Semester.',
  description:
    'Coding for Change ist eine Studierendeninitiative an der Technischen Universität München. ' +
    'Wir entwickeln Software für gemeinnützige Organisationen, veranstalten Hackathons und bringen ' +
    'Studierende zusammen, um Code für soziale Zwecke einzusetzen. Jedes Projekt verbindet ' +
    'Entwicklungsstudent:innen mit einer echten NGO und wird innerhalb eines Semesters fertiggestellt.',
  copyrightText: '© 2026 Coding for Change',
  windowTitle: 'Coding for Change',
  stats: [
    { value: '4', label: 'NGOs unterstützt' },
    { value: '10+', label: 'Aktive Mitglieder' },
    { value: '150+', label: 'Nutzer:innen sparen Zeit' },
  ],
};

const partnerDe = {
  title: 'Ein Problem, das es zu lösen lohnt? Lass es uns gemeinsam bauen.',
  intro:
    'Wir entwickeln gemeinsam mit gemeinnützigen Organisationen die Software, die sie brauchen – ' +
    'kostenlos, geliefert von einem festen Studierendenteam in einem Semester. Kein Lock-in, ' +
    'keine Rechnung: Was wir bauen, gehört Ihnen.',
  valueProps: [
    { title: 'Ein festes Team', description: 'Engineering, Produkt und Design, die ein Semester lang nur an Ihrem Projekt arbeiten.' },
    { title: 'Produktreife Software, kein Prototyp', description: 'Echte, wartbare Software, die live geht und nach der Übergabe weiterläuft.' },
    { title: 'Kostenlos', description: 'Finanziert durch unsere universitäre Anbindung und Sponsoren – für Sie entstehen keine Kosten.' },
    { title: 'Saubere Übergabe', description: 'Dokumentation, ein Walkthrough und der Code – alles gehört Ihnen, ganz ohne Abhängigkeit von uns.' },
  ],
  process: [
    { title: 'Erzählen Sie uns das Problem', description: 'Ein erstes Gespräch, um Ihre Arbeit und den größten Schmerzpunkt zu verstehen.' },
    { title: 'Wir schneiden es gemeinsam zu', description: 'Wir formen eine Lösung, die realistisch in einem Semester lieferbar ist.' },
    { title: 'Das Team entwickelt', description: 'Ein Studierendenteam baut sie in agilen Sprints – Sie sind durchgehend eingebunden.' },
    { title: 'Übergabe & Support', description: 'Wir liefern das fertige Produkt mit Dokumentation und einem Support-Zeitraum.' },
  ],
  commitment:
    'Was wir brauchen: eine feste Ansprechperson und etwas ihrer Zeit über das Semester, damit wir das Richtige bauen.',
  ctaHeading: 'Bereit für ein Gespräch?',
  ctaText:
    'Erzählen Sie uns von Ihrer Organisation und Ihrem Problem – wir kümmern uns um den Rest.',
};

const membershipDe = {
  title: 'Werde Mitglied',
  description:
    'Wir sind eine interdisziplinäre Gemeinschaft von Studierenden, die echte Software für ' +
    'gemeinnützige Organisationen entwickeln – und dafür braucht es mehr als Entwickler:innen. ' +
    'Es braucht Menschen, die mit Partnern sprechen und das eigentliche Problem finden, die unsere ' +
    'Geschichte erzählen und das Team wachsen lassen. Egal was du studierst – bei uns findest du ' +
    'einen Weg, echten Impact zu schaffen.',
  benefits: [
    { text: 'Echte Arbeit für echte gemeinnützige Kunden leisten' },
    { text: 'Von erfahrenen Leads lernen und praxisnahe Fähigkeiten aufbauen' },
    { text: 'Portfolio aus wirkungsvollen Projekten aufbauen' },
    { text: 'Mit Münchens Tech- und Social-Impact-Community vernetzen' },
    { text: 'Workshops, Hackathons und Socializing während des Semesters' },
  ],
  requirements: [
    { text: 'Du studierst oder arbeitest in Deutschland' },
    { text: 'Du kannst dich ca. 5 Stunden pro Woche während des Semesters einbringen' },
    {
      text:
        'Dir liegt gesellschaftlicher Impact am Herzen – Programmiererfahrung ist ' +
        'willkommen, aber nicht für jede Rolle nötig',
    },
  ],
  tracks: [
    {
      title: 'Entwicklung',
      description:
        'Entwirf und entwickle die Software, die die Probleme unserer Partner löst – ' +
        'Frontend, Backend und alles dazwischen. Alle Erfahrungsstufen willkommen.',
    },
    {
      title: 'Consulting & Produkt',
      description:
        'Arbeite direkt mit unseren gemeinnützigen Partnern zusammen, um das eigentliche ' +
        'Problem zu erkennen, die Lösung zu skizzieren und sie für das Entwicklungsteam ' +
        'zu übersetzen. Ideal für Studierende aus BWL, Management und Produkt.',
    },
    {
      title: 'Marketing & Kommunikation',
      description:
        'Erhöhe unsere Reichweite und erzähle die Geschichte unseres Impacts – Social Media, ' +
        'Content, Events und Partnerschaften.',
    },
    {
      title: 'People & Operations',
      description:
        'Gewinne, onboarde und unterstütze unsere Mitglieder und halte den Club am Laufen, ' +
        'während wir wachsen. Das organisatorische Rückgrat von Coding for Change.',
    },
  ],
};

const teamDe = [
  { role: 'Vorsitzende', bio: 'Informatik-Masterstudentin, die Coding for Change nach einem Freiwilligen-Semester bei einer lokalen NGO gegründet hat. Hält die Teams zusammen.' },
  { role: 'Stellvertretender Vorsitzender', bio: 'Backend-Entwickler mit Fokus auf Partnerschaften. Sorgt dafür, dass jede NGO ein passendes Projektteam bekommt.' },
  { role: 'Projektleiterin', bio: 'Full-Stack-Entwicklerin, die drei NGO-Projekte von Kick-off bis Übergabe geleitet hat. Begeistert vom Mentoring von Erstbeitragenden.' },
  { role: 'Schatzmeister', bio: 'Wirtschaftsinformatikstudent, der Finanzen und Förderanträge des Clubs verwaltet, damit sich die Teams aufs Bauen konzentrieren können.' },
  { role: 'Design Lead', bio: 'Designerin und Frontend-Entwicklerin, die sicherstellt, dass die Software, die wir übergeben, so bedienbar wie funktional ist.' },
  { role: 'Outreach Lead', bio: 'Organisiert Hackathons, Workshops und die Partnergewinnung. Wenn Coding for Change bei einem Event in München dabei ist, hat David es organisiert.' },
];

const projectsDe = [
  {
    title: 'Ehrenamtsportal',
    ngoPartner: 'Münchner Tafel',
    description: 'Ein Webportal zur Koordination von Freiwilligenschichten und Lebensmittellogistik, das ein Gewirr aus Tabellen und Telefonaten ersetzt.',
    links: [{ label: 'Repository', url: 'https://github.com/coding-for-change' }],
    impact: 'Koordiniert über 200 Freiwilligenschichten pro Woche – aus stundenlanger Verwaltung werden wenige Klicks.',
    problem:
      'Die Münchner Tafel koordinierte jede Woche Hunderte Freiwilligenschichten über Tabellen und Telefonate. Das Team verbrachte Stunden mit dem Abgleich von Plänen, und Freiwillige erschienen oft am falschen Ort.',
    approach:
      'Ein Studierendenteam baute ein Webportal mit React-Frontend und Node.js/PostgreSQL-Backend – ausgelegt auf den echten Arbeitsalltag. Freiwillige sehen kommende Schichten und melden sich in Sekunden an; das Team erhält ein Live-Dashboard über alle Standorte.',
    outcome:
      'Das Portal ersetzte den Tabellen-und-Telefon-Prozess vollständig. Freiwillige verwalten ihre Schichten selbst, No-Shows gingen zurück, und das Koordinationsteam gewann Stunden pro Woche zurück.',
    quote: {
      text: 'Zum ersten Mal sehen wir unsere ganze Woche an Schichten auf einen Blick. Das hat dem Team enorm viel Last abgenommen.',
      role: 'Münchner Tafel',
    },
    impactHeadline: 'Wie die Münchner Tafel ihren Koordinator:innen die Woche zurückgab',
    impactChallenge:
      'Jede Woche verlässt sich die Münchner Tafel auf Hunderte Freiwillige, um Lebensmittel zu den Menschen zu bringen, die sie brauchen. Den Überblick zu behalten – wer wann kommt – bedeutete ein Gewirr aus Tabellen und Telefonaten, und Freiwillige standen trotzdem am falschen Ort.',
    impactSolution:
      'Wir haben ein einfaches Portal gebaut, in dem Freiwillige die kommende Woche sehen und sich mit wenigen Klicks eintragen, während Koordinator:innen live sehen, wer welche Schicht abdeckt. Keine Schulung nötig – es funktioniert so, wie das Team ohnehin über seine Woche denkt.',
    impactResults:
      'Tabellen und Telefon-Pingpong sind Geschichte. Freiwillige organisieren sich selbst, No-Shows gingen zurück, und das Koordinationsteam gewann Stunden pro Woche zurück – für die Mission statt für den Dienstplan.',
    ngoFaq: [
      { question: 'Was kostet uns das?', answer: 'Nichts. Unsere Arbeit wird durch unsere universitäre Anbindung und Sponsoren finanziert – für Ihre Organisation entstehen keine Kosten.' },
      { question: 'Wie lange dauert es?', answer: 'Ein einziges Semester, vom ersten Gespräch bis zum fertigen Produkt, das an Ihr Team übergeben wird.' },
      { question: 'Was passiert nach der Übergabe?', answer: 'Es gehört Ihnen – der Code, die Dokumentation und ein Walkthrough – mit einem Support-Zeitraum danach. Kein Lock-in.' },
    ],
  },
  {
    title: 'Spenden-Tracker',
    ngoPartner: 'Lebenshilfe München',
    description: 'Ein Dashboard, das dem Fundraising-Team eine Live-Übersicht über Spenden, Dauerspender und Kampagnenleistung bietet.',
    links: [],
  },
  {
    title: 'Mentoring-Plattform',
    ngoPartner: 'Start with a Friend',
    description: 'Ein algorithmusgestütztes Tool, das Neuankömmlinge anhand von Sprache, Interessen und Verfügbarkeit mit lokalen Mentor:innen verbindet.',
    links: [],
  },
  {
    title: 'Impact-Dashboard',
    ngoPartner: 'Green City e.V.',
    description: 'Ein öffentliches Dashboard, das die Umweltwirkung der Stadtbegrünungsprojekte der Organisation in München visualisiert.',
    links: [],
  },
  {
    title: 'Veranstaltungsmanagement-Tool',
    ngoPartner: 'Caritas München',
    description: 'Ein internes Tool zur Planung von Gemeinschaftsveranstaltungen, Anwesenheitsverfolgung und dem Versand von Erinnerungen.',
    links: [{ label: 'Repository', url: 'https://github.com/coding-for-change' }],
  },
];

const eventsDe = [
  {
    title: 'Semesterauftakt',
    location: 'TUM Hauptcampus, Raum 1100',
    description: 'Lern die Teams kennen, erfahre mehr über die NGO-Projekte dieses Semesters und wie du mitmachen kannst. Pizza inklusive.',
  },
  {
    title: 'Code for Good Hackathon',
    location: 'TUM Garching, Informatikgebäude',
    description: 'Ein 24-Stunden-Hackathon, bei dem Studierendenteams Prototypen für echte Herausforderungen von Münchner Nonprofits entwickeln.',
    link: { label: 'Anmelden', url: 'https://codingforchange.com/events' },
  },
  {
    title: 'Einführung in React – Workshop',
    location: 'Online',
    description: 'Ein praxisorientierter Anfänger-Workshop zu Komponenten, State und Hooks – alles, was du für dein erstes Projektteam brauchst.',
  },
  {
    title: 'Semesterabschluss-Feier',
    location: 'Münchner Innenstadt',
    description: 'Feiere mit den Teams und unseren Partnerorganisationen die Projekte, die wir in diesem Semester umgesetzt haben.',
  },
  {
    title: 'Winter-Hackathon 2025',
    location: 'TUM Garching',
    description: 'Unser Winter-Hackathon brachte vier NGO-Prototypen hervor, von denen zwei in diesem Semester zu vollständigen Projektteams wurden.',
  },
  {
    title: 'Git & GitHub Workshop',
    location: 'TUM Hauptcampus',
    description: 'Eine Einführung in Versionskontrolle und Kollaborations-Workflows für neue Mitglieder.',
  },
];

const faqsDe = [
  {
    question: 'Brauche ich Vorkenntnisse, um beizutreten?',
    answer: 'Nein. Wir begleiten Mitglieder aller Erfahrungsstufen und verbinden Neueinsteiger:innen mit erfahrenen Leads. Neugier und Engagement zählen mehr als ein polierter Lebenslauf.',
  },
  {
    question: 'Wie viel Zeit erfordert die Mitgliedschaft?',
    answer: 'Rechne mit rund 4–6 Stunden pro Woche während des Semesters. Projektteams legen ihre Zeitpläne selbst fest.',
  },
  {
    question: 'Gibt es einen Mitgliedsbeitrag?',
    answer: 'Nein. Coding for Change ist kostenlos – wir werden durch Sponsoren und Hochschulförderung finanziert.',
  },
  {
    question: 'Wie werden Projekte ausgewählt?',
    answer: 'Wir planen Projekte mit NGO-Partnern, die innerhalb eines Semesters umsetzbar sind, und matchen sie mit einem Studierendenteam basierend auf Fähigkeiten und Interesse.',
  },
  {
    question: 'Kann meine Organisation ein Projekt anfragen?',
    answer: 'Ja. Gemeinnützige Organisationen können sich über unser Kontaktformular melden. Wir arbeiten unentgeltlich mit mission-orientierten Organisationen zusammen.',
  },
  {
    question: 'Welche Technologien verwendet ihr?',
    answer: 'Das hängt vom Projekt ab, aber die meisten Teams arbeiten mit React, TypeScript und Node.js. Wir wählen den Stack, der am besten zu den Bedürfnissen der Partner passt.',
  },
  {
    question: 'Muss ich Informatik studieren?',
    answer: 'Nein. Wir begrüßen Studierende aller Fachrichtungen – Designer:innen, produktaffine Köpfe und Entwickler:innen sind alle willkommen.',
  },
];

const sponsorsDe = [
  { description: 'Unsere Heimuniversität, die Räume, Akkreditierung und eine Community von Studierenden bereitstellt.' },
  { description: 'Münchens Zentrum für Innovation und Unternehmertum, das unsere Hackathons und Events unterstützt.' },
  { description: 'Stellt Tools und Ressourcen bereit, die unsere Projektteams am Liefern halten.' },
  { description: 'Ein lokales Netzwerk, das Studierendeninitiativen mit Mentoren verbindet.' },
  { description: 'Unterstützt Graswurzel-Tech-for-Good-Arbeit in ganz Deutschland.' },
];

// ─── Legal (Impressum + Datenschutz) ─────────────────────────────────────────
// The legal text is German by law and identical in both locales, so it is only
// seeded for the default locale (en); the de locale falls back to it.
// Stored as Payload lexical rich text, built with the small helpers below.

const txt = (text, opts = {}) => ({
  type: 'text',
  detail: 0,
  format: opts.bold ? 1 : 0,
  mode: 'normal',
  style: '',
  text,
  version: 1,
});

const bold = (text) => txt(text, { bold: true });

const linebreak = () => ({ type: 'linebreak', version: 1 });

const link = (text, url) => ({
  type: 'link',
  version: 2,
  format: '',
  indent: 0,
  direction: 'ltr',
  fields: { linkType: 'custom', url, newTab: false },
  children: [txt(text)],
});

// Inline children: strings become text nodes, splitting on \n into linebreaks.
const inline = (children) =>
  children.flatMap((child) => {
    if (typeof child !== 'string') return [child];
    const out = [];
    child.split('\n').forEach((part, i) => {
      if (i > 0) out.push(linebreak());
      if (part) out.push(txt(part));
    });
    return out;
  });

const para = (...children) => ({
  type: 'paragraph',
  version: 1,
  format: '',
  indent: 0,
  direction: 'ltr',
  textFormat: 0,
  children: inline(children),
});

const heading = (tag, text) => ({
  type: 'heading',
  tag,
  version: 1,
  format: '',
  indent: 0,
  direction: 'ltr',
  children: [txt(text)],
});

const hr = () => ({ type: 'horizontalrule', version: 1 });

const doc = (...nodes) => ({
  root: {
    type: 'root',
    version: 1,
    format: '',
    indent: 0,
    direction: 'ltr',
    children: nodes,
  },
});

const legalEmail = siteConfig.email;
const mailto = link(legalEmail, `mailto:${legalEmail}`);

const legal = {
  impressum: doc(
    heading('h2', 'Impressum'),
    para(bold('Angaben gem. § 5 DDG')),
    para(bold('Coding for Change')),
    para('Montgelasstraße 33\n80538 München'),
    para(bold('Vertreten durch:')),
    para('David Franke und Jakob Landbrecht'),
    para(bold('Kontakt:')),
    para('E-Mail: ', mailto),
    para(bold('Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:')),
    para('David Franke und Jakob Landbrecht\nMontgelasstraße 33\n80538 München'),
    para(bold('Haftungsausschluss:')),
    para(bold('Haftung für Inhalte')),
    para(
      'Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die ' +
        'Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch ' +
        'keine Gewähr übernehmen. Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG ' +
        'für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen ' +
        'verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch ' +
        'nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu ' +
        'überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige ' +
        'Tätigkeit hinweisen.'
    ),
    para(bold('Haftung für Links')),
    para(
      'Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte ' +
        'wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch ' +
        'keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der ' +
        'jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten ' +
        'Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße ' +
        'überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht ' +
        'erkennbar.'
    ),
    para(bold('Urheberrecht')),
    para(
      'Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten ' +
        'unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, ' +
        'Verbreitung und jede Art der Verwertung außerhalb der Grenzen des ' +
        'Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors ' +
        'bzw. Erstellers.'
    )
  ),
  privacyPolicy: doc(
    heading('h2', 'Datenschutzerklärung'),
    heading('h3', '1. Verantwortlicher'),
    para('Verantwortlicher im Sinne der DSGVO ist:'),
    para('Coding for Change'),
    para('Montgelasstraße 33, 80538 München'),
    para('E-Mail: ', mailto),
    heading('h3', '2. Allgemeines zur Datenverarbeitung'),
    para(
      'Der Schutz Ihrer persönlichen Daten ist uns ein wichtiges Anliegen. Diese ' +
        'Datenschutzerklärung informiert Sie darüber, welche Daten beim Besuch ' +
        'unserer Website erhoben werden und wie diese verwendet werden.'
    ),
    heading('h3', '3. Hosting'),
    para(
      'Diese Website wird auf einem Virtual Private Server (VPS) der Hetzner Online ' +
        'GmbH, Industriestr. 25, 91710 Gunzenhausen, Deutschland betrieben. Hetzner ' +
        'stellt lediglich die Server-Infrastruktur bereit und verarbeitet dabei im ' +
        'Rahmen des Betriebs personenbezogene Daten (z.B. IP-Adressen) als ' +
        'Auftragsverarbeiter.'
    ),
    para(
      'Der Webserver auf unserem VPS ist so konfiguriert, dass keine zusätzlichen ' +
        'personenbezogenen Daten (wie Browsertyp, Betriebssystem oder Referrer-URLs) ' +
        'in Log-Dateien gespeichert werden. Die Rechtsgrundlage für die ' +
        'Datenverarbeitung im Rahmen des Hostings ist Art. 6 Abs. 1 lit. f DSGVO ' +
        '(berechtigtes Interesse an einer zuverlässigen Bereitstellung der Website).'
    ),
    heading('h3', '4. Cookies und Tracking'),
    para(
      'Diese Website verwendet keine Cookies, Analysetools oder sonstige ' +
        'Tracking-Technologien.'
    ),
    heading('h3', '5. Externe Links'),
    para(
      'Unsere Website kann Links zu externen Websites enthalten. Auf die Inhalte und ' +
        'Datenschutzpraktiken dieser externen Seiten haben wir keinen Einfluss.'
    ),
    heading('h3', '6. Ihre Rechte'),
    para('Sie haben gemäß DSGVO folgende Rechte bezüglich Ihrer personenbezogenen Daten:'),
    para(
      '• Recht auf Auskunft (Art. 15 DSGVO)\n' +
        '• Recht auf Berichtigung (Art. 16 DSGVO)\n' +
        '• Recht auf Löschung (Art. 17 DSGVO)\n' +
        '• Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)\n' +
        '• Recht auf Datenübertragbarkeit (Art. 20 DSGVO)\n' +
        '• Widerspruchsrecht (Art. 21 DSGVO)'
    ),
    para(
      'Zudem haben Sie das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über ' +
        'die Verarbeitung Ihrer personenbezogenen Daten zu beschweren. Die zuständige ' +
        'Aufsichtsbehörde ist das Bayerische Landesamt für Datenschutzaufsicht ' +
        '(BayLDA).'
    ),
    heading('h3', '7. Kontakt'),
    para('Bei Fragen zur Datenschutzerklärung kontaktieren Sie uns unter ', mailto, '.')
  ),
};

// ─── HTTP helpers ────────────────────────────────────────────────────────────

const jsonRequest = async (method, path, body, cookie) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return res;
};

const postJson = (path, body, cookie) => jsonRequest('POST', path, body, cookie);
const patchJson = (path, body, cookie) => jsonRequest('PATCH', path, body, cookie);

/**
 * Seed a global that has localized *array* fields so BOTH locales are kept.
 * Writing EN then DE without row ids makes the DE write replace the arrays and
 * null out the EN values, so we read the row ids back after the EN write and
 * attach them to the DE rows (Payload then updates the same rows per-locale).
 */
const seedGlobalLocalized = async (slug, en, de, arrayKeys, cookie) => {
  await postJson(`/api/globals/${slug}`, en, cookie).then(assertOk(`${slug} (en)`));
  const current = await (
    await fetch(`${BASE}/api/globals/${slug}`, { headers: { cookie } })
  ).json();
  const deBody = { ...de };
  for (const key of arrayKeys) {
    const ids = (current[key] || []).map((row) => row.id);
    deBody[key] = (de[key] || []).map((row, i) => ({ ...row, id: ids[i] }));
  }
  await postJson(`/api/globals/${slug}?locale=de`, deBody, cookie).then(
    assertOk(`${slug} (de)`)
  );
};

/** Extract the Payload auth cookie (name=value) from a login response. */
const authCookieFrom = (res) => {
  const cookies = res.headers.getSetCookie?.() || [];
  const tokenCookie = cookies.find((c) => c.startsWith('payload-token='));
  return tokenCookie ? tokenCookie.split(';')[0] : null;
};

/** Log in, creating the first admin user if the CMS has none yet. */
const authenticate = async () => {
  const creds = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };

  let res = await postJson('/api/users/login', creds);
  if (!res.ok) {
    let created = await postJson('/api/users/first-register', creds);
    if (!created.ok) {
      created = await postJson('/api/users', creds);
    }
    if (!created.ok) {
      throw new Error(`Could not create admin user: ${created.status} ${await created.text()}`);
    }
    res = await postJson('/api/users/login', creds);
  }
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  const cookie = authCookieFrom(res);
  if (!cookie) throw new Error('Login succeeded but no auth cookie was returned');
  return cookie;
};

/** Poll the CMS until it answers — it may still be booting after `up`. */
const waitForCms = async () => {
  const deadline = Date.now() + 90_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/team?limit=1`);
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    process.stdout.write('.');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`CMS not reachable at ${BASE} — is it running? (${lastError?.message})`);
};

/** Returns a .then() handler that throws on a non-OK response. */
const assertOk = (label) => async (res) => {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create ${label}: ${res.status} ${text}`);
  }
  return res;
};

// ─── Seed ────────────────────────────────────────────────────────────────────

const seed = async () => {
  console.log(`Seeding CMS at ${BASE}`);

  const existing = await waitForCms();
  const json = await existing.json();
  if ((json.totalDocs ?? 0) > 0) {
    console.log('\nCMS already has content — nothing to do.');
    console.log('To reseed from scratch: docker compose down -v, then up again.');
    return;
  }

  const cookie = await authenticate();
  console.log(`\nAuthenticated as ${ADMIN_EMAIL}`);

  // ── Globals ──────────────────────────────────────────────────────────────
  await postJson('/api/globals/site-config', siteConfig, cookie).then(assertOk('site-config (en)'));
  await postJson('/api/globals/site-config?locale=de', siteConfigDe, cookie).then(assertOk('site-config (de)'));

  // membership + partner have localized array fields — keep both locales.
  await seedGlobalLocalized('membership', membership, membershipDe, ['benefits', 'requirements', 'tracks'], cookie);
  await seedGlobalLocalized('partner', partner, partnerDe, ['valueProps', 'process'], cookie);

  // Legal text is German by law; seeded once for the default locale (de falls back).
  await postJson('/api/globals/legal', legal, cookie).then(assertOk('legal'));

  console.log('Updated globals: site-config, membership, partner, legal (en + de)');

  // ── Sponsor tiers ──────────────────────────────────────────────────────────
  // Create the tier records first, then point each sponsor's `tierRef` at the
  // matching tier (this is also the backfill: it maps the deprecated fixed
  // `tier` value to a tier record).
  const sponsorTierDefs = [
    { value: 'platinum', label: 'Platinum', labelDe: 'Platin', order: 10 },
    { value: 'gold', label: 'Gold', labelDe: 'Gold', order: 20 },
    { value: 'silver', label: 'Silver', labelDe: 'Silber', order: 30 },
    { value: 'bronze', label: 'Bronze', labelDe: 'Bronze', order: 40 },
    { value: 'partner', label: 'Partners', labelDe: 'Partner', order: 50 },
  ];
  const tierIdByValue = {};
  for (const td of sponsorTierDefs) {
    const res = await postJson(
      '/api/sponsor-tiers',
      { label: td.label, order: td.order },
      cookie
    ).then(assertOk('sponsor-tiers (en)'));
    const id = (await res.json())?.doc?.id;
    tierIdByValue[td.value] = id;
    if (id) {
      await patchJson(
        `/api/sponsor-tiers/${id}?locale=de`,
        { label: td.labelDe },
        cookie
      ).then(assertOk('sponsor-tiers (de)'));
    }
  }
  for (const s of sponsors) s.tierRef = tierIdByValue[s.tier];
  console.log(`Created ${sponsorTierDefs.length} sponsor-tiers (en + de)`);

  // ── Collections ──────────────────────────────────────────────────────────
  // Create English items first (returns IDs), then PATCH German translations.
  const collections = [
    { slug: 'team',     en: team,     de: teamDe },
    { slug: 'projects', en: projects, de: projectsDe },
    { slug: 'events',   en: events,   de: eventsDe },
    { slug: 'faq',      en: faqs,     de: faqsDe },
    { slug: 'sponsors', en: sponsors, de: sponsorsDe },
  ];

  // Captured English-item IDs per slug, so the blog posts below can reference
  // their author (team) and project relationships.
  const idsBySlug = {};

  for (const { slug, en, de } of collections) {
    const ids = [];
    const enDocs = [];

    for (const item of en) {
      const res = await postJson(`/api/${slug}`, item, cookie).then(assertOk(`${slug} (en)`));
      const data = await res.json();
      ids.push(data?.doc?.id);
      enDocs.push(data?.doc);
    }

    for (let i = 0; i < de.length; i++) {
      const id = ids[i];
      if (!id) continue;
      const body = { ...de[i] };
      const enDoc = enDocs[i] || {};
      // Localized *array* fields need the EN row ids carried into the DE write,
      // or Payload replaces the array and nulls the EN values. For arrays the DE
      // payload omits (e.g. technologies — names don't translate) we carry the EN
      // rows verbatim; for arrays it provides (links, ngoFaq, …) we attach the EN
      // ids by index so the same rows are updated per-locale.
      for (const [key, enArr] of Object.entries(enDoc)) {
        const isRowArray =
          Array.isArray(enArr) &&
          enArr.length > 0 &&
          enArr[0] &&
          typeof enArr[0] === 'object' &&
          'id' in enArr[0];
        if (!isRowArray) continue;
        if (body[key] === undefined) {
          body[key] = enArr.map((row) => ({ ...row }));
        } else if (Array.isArray(body[key])) {
          body[key] = body[key].map((row, j) => ({ ...row, id: enArr[j]?.id }));
        }
      }
      await patchJson(`/api/${slug}/${id}?locale=de`, body, cookie).then(assertOk(`${slug}[${i}] (de)`));
    }

    idsBySlug[slug] = ids;
    console.log(`Created ${en.length} ${slug} entries (en + de)`);
  }

  const teamIds = idsBySlug.team ?? [];
  const projectIds = idsBySlug.projects ?? [];

  // Build blog posts using the captured IDs (Lena=0, Jonas=1; Volunteer Portal=0, Donation Tracker=1).
  const lexicalParagraph = (text) => ({
    type: 'paragraph',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [{ type: 'text', text, format: 0, version: 1 }],
  });

  const lexicalHeading = (tag, text) => ({
    type: 'heading',
    tag,
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [{ type: 'text', text, format: 0, version: 1 }],
  });

  const makeDoc = (...nodes) => ({
    root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: nodes },
  });

  const blogPosts = [
    {
      title: 'How We Built the Volunteer Portal',
      slug: 'how-we-built-the-volunteer-portal',
      publishedAt: '2026-04-10T10:00:00.000Z',
      excerpt:
        'A behind-the-scenes look at how our team replaced a tangle of spreadsheets with a real web portal for Münchner Tafel — in a single semester.',
      author: teamIds[0],
      project: projectIds[0],
      tags: [{ tag: 'technical' }, { tag: 'react' }, { tag: 'postgresql' }],
      content: makeDoc(
        lexicalHeading('h2', 'The Problem'),
        lexicalParagraph(
          'Münchner Tafel coordinated hundreds of volunteer shifts every week using spreadsheets and phone calls. Staff spent hours reconciling schedules and volunteers often showed up to the wrong location.'
        ),
        lexicalHeading('h2', 'Our Approach'),
        lexicalParagraph(
          'We built a web portal with React on the frontend and a Node.js / PostgreSQL backend. Volunteers can log in, view upcoming shifts, and sign up in seconds. Staff get a live dashboard of coverage.'
        ),
        lexicalHeading('h2', 'What We Learned'),
        lexicalParagraph(
          'Building for real users is very different from coursework. Requirements changed every two weeks. We learned to scope tightly, ship early, and iterate based on feedback from the client.'
        )
      ),
    },
    {
      title: 'Code for Good: Our Hackathon Recap',
      slug: 'code-for-good-hackathon-recap',
      publishedAt: '2026-03-18T10:00:00.000Z',
      excerpt:
        'Twenty student teams, four NGO challenges, and 24 hours. Here is what happened at our Code for Good hackathon.',
      author: teamIds[1],
      tags: [{ tag: 'hackathon' }, { tag: 'community' }],
      content: makeDoc(
        lexicalHeading('h2', 'Setting the Stage'),
        lexicalParagraph(
          'This was our biggest event yet — over sixty students gathered in the Garching informatics building for a 24-hour sprint on real challenges submitted by Munich non-profits.'
        ),
        lexicalHeading('h2', 'The Challenges'),
        lexicalParagraph(
          'Four NGOs brought problems ranging from volunteer scheduling to impact visualisation. Teams self-selected based on interest, forming groups of three to five people.'
        ),
        lexicalHeading('h2', 'Outcomes'),
        lexicalParagraph(
          'Two of the prototypes built during the hackathon became full Coding for Change projects the following semester. That is the goal: validate the idea quickly, then commit to shipping it properly.'
        )
      ),
    },
    {
      title: 'Getting Started with NGO Partnerships',
      slug: 'getting-started-with-ngo-partnerships',
      publishedAt: '2026-02-05T10:00:00.000Z',
      excerpt:
        'How we source, scope, and kick off partnerships with non-profit organisations — and what makes a project succeed from the very first meeting.',
      author: teamIds[1],
      tags: [{ tag: 'community' }, { tag: 'process' }],
      content: makeDoc(
        lexicalHeading('h2', 'Finding the Right Partners'),
        lexicalParagraph(
          'Not every NGO is ready for a student software project. We look for organisations that have a concrete, scoped problem, at least one staff contact who can engage weekly, and patience for an iterative process.'
        ),
        lexicalHeading('h2', 'Scoping the Work'),
        lexicalParagraph(
          'The first meeting is about listening. We ask the partner to walk us through their current process, identify the biggest pain point, and describe what success looks like in concrete terms.'
        ),
        lexicalHeading('h2', 'Setting Expectations'),
        lexicalParagraph(
          'We are explicit that we are students, not contractors. That means some uncertainty, some learning curves, and a process that values feedback over a fixed spec. Partners who embrace that tend to get the best results.'
        )
      ),
    },
  ];

  for (const post of blogPosts) {
    await postJson('/api/blog-posts', post, cookie).then(assertOk('blog-posts entry'));
  }
  console.log(`Created ${blogPosts.length} blog-posts entries`);

  // ── Contact form (form-builder plugin) ────────────────────────────────────
  // The inner site renders the form titled "Contact" dynamically and POSTs to
  // /api/form-submissions. Title is kept identical across locales so the
  // frontend lookup is locale-independent; labels/messages are localised below.
  const contactToEmail = process.env.CONTACT_TO_EMAIL || 'team@codingforchange.com';
  const contactFromEmail = process.env.EMAIL_FROM || 'noreply@codingforchange.com';

  const contactForm = {
    title: 'Contact',
    submitButtonLabel: 'Send Message',
    confirmationType: 'message',
    confirmationMessage: makeDoc(
      lexicalParagraph(
        "Thanks for reaching out! We've received your message and will get back to you soon."
      )
    ),
    fields: [
      { blockType: 'text', name: 'name', label: 'Your name', required: true, width: 100 },
      { blockType: 'email', name: 'email', label: 'Email', required: true, width: 100 },
      {
        blockType: 'text',
        name: 'organization',
        label: 'Organization / NGO (optional)',
        required: false,
        width: 100,
      },
      { blockType: 'textarea', name: 'message', label: 'Message', required: true, width: 100 },
    ],
    emails: [
      {
        emailTo: contactToEmail,
        emailFrom: contactFromEmail,
        replyTo: '{{email}}',
        subject: 'New contact enquiry from {{name}}',
        message: makeDoc(
          lexicalParagraph('You have a new contact form submission:'),
          lexicalParagraph('{{*:table}}')
        ),
      },
    ],
  };

  const formRes = await postJson('/api/forms', contactForm, cookie).then(assertOk('forms (en)'));
  const formDoc = (await formRes.json())?.doc;

  // Localise field labels + confirmation message for German. Block rows are
  // matched by their generated `id`, so reuse the ids from the create response.
  const deLabels = {
    name: 'Ihr Name',
    email: 'E-Mail',
    organization: 'Organisation / NGO (optional)',
    message: 'Nachricht',
  };
  if (formDoc?.id) {
    await patchJson(
      `/api/forms/${formDoc.id}?locale=de`,
      {
        title: 'Contact',
        submitButtonLabel: 'Nachricht senden',
        confirmationMessage: makeDoc(
          lexicalParagraph(
            'Danke für Ihre Nachricht! Wir haben sie erhalten und melden uns bald bei Ihnen.'
          )
        ),
        fields: (formDoc.fields ?? []).map((f) => ({
          id: f.id,
          blockType: f.blockType,
          name: f.name,
          label: deLabels[f.name] ?? f.label,
          required: f.required,
          width: f.width,
        })),
      },
      cookie
    ).then(assertOk('forms (de)'));
  }
  console.log('Created Contact form (en + de)');

  // ── Application + TechTour forms, TechTour page ───────────────────────────
  // Same definitions the production upsert script uses, so dev renders the real
  // forms (CV upload, event multi-select, the cross "also …" checkboxes).
  await upsertForms({
    base: BASE,
    cookie,
    toEmail: contactToEmail,
    fromEmail: contactFromEmail,
    log: (msg) => console.log(msg),
  });

  console.log('\nSeed complete. Admin login:');
  console.log(`  email:    ${ADMIN_EMAIL}`);
  console.log(`  password: ${ADMIN_PASSWORD}`);
};

seed().catch((error) => {
  console.error('\nSeed failed:', error.message || error);
  process.exit(1);
});
