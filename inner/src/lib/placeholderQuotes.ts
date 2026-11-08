import type { CmsMedia, CmsTestimonial } from '../api/types';

/**
 * Stand-ins for the voices sections (homepage, /ngos, /partners) while
 * Homepage → Voices in the CMS is empty. Development only: Testimonials.tsx
 * never uses them in a production build, so nothing here reaches the live
 * site – a quote goes live by entering it in the CMS.
 *
 * - NGO: Katharina Berger (Lebenshilfe München), as quoted in the Süddeutsche
 *   Zeitung's article on our project. Enter it in the CMS, with her photo,
 *   once she has OK'd it for our website.
 * - Member: a DRAFT for Richard Ziegler – not his words until he has approved
 *   or rewritten it. His portrait is the one on /team (CMS media 33).
 * - Company: an invented template until a partner gives us a quote.
 */
const RICHARD_PHOTO: CmsMedia = {
    id: 33,
    url: '/api/media/file/Richard%20Ziegler.webp',
    alt: 'Richard Ziegler',
    filename: 'Richard Ziegler.webp',
    mimeType: 'image/webp',
    filesize: 0,
    sizes: { thumbnail: { url: '/api/media/file/Richard%20Ziegler-329x327.webp' } },
};

export function placeholderQuotes(locale: string): CmsTestimonial[] {
    if (locale === 'de') {
        return [
            {
                quote: 'Weniger Verwaltungsaufwand bedeutet Zeitersparnis, die uns ermöglicht, für mehr Kinder und Jugendliche mit Unterstützungsbedarf gleichberechtigte Teilhabe möglich zu machen.',
                name: 'Katharina Berger',
                role: 'Koordination Schul- und Individualbegleitung',
                organisation: 'Lebenshilfe München',
                audience: 'ngo',
            },
            {
                quote: 'Bei Coding for Change habe ich früh echte Verantwortung übernommen. Ich bringe ein, was ich kann – und sehe direkt, was unsere Software bei einer NGO bewirkt.',
                name: 'Richard Ziegler',
                role: 'Project Lead',
                organisation: 'Coding for Change',
                audience: 'member',
                photo: RICHARD_PHOTO,
            },
            {
                quote: 'Die Studierenden arbeiten wie ein gutes Produktteam: schnell, gründlich und mit echtem Interesse daran, was die Software bewirkt.',
                name: 'Vorname Nachname',
                role: 'Head of Engineering',
                organisation: 'Partnerunternehmen (Platzhalter)',
                audience: 'company',
            },
        ];
    }
    return [
        {
            quote: 'Less admin means time saved – time that lets us make equal participation possible for more children and young people who need support.',
            name: 'Katharina Berger',
            role: 'Coordinator, school and individual assistance',
            organisation: 'Lebenshilfe München',
            audience: 'ngo',
        },
        {
            quote: 'At Coding for Change I took on real responsibility early on. I bring in what I’m good at – and see right away what our software does for an NGO.',
            name: 'Richard Ziegler',
            role: 'Project Lead',
            organisation: 'Coding for Change',
            audience: 'member',
            photo: RICHARD_PHOTO,
        },
        {
            quote: 'The students work like a good product team: fast, thorough and genuinely interested in what the software changes.',
            name: 'First Last',
            role: 'Head of Engineering',
            organisation: 'Partner company (placeholder)',
            audience: 'company',
        },
    ];
}
