import type { CmsTestimonial } from '../api/types';

/**
 * Invented quotes for the voices sections (homepage, /ngos, /partners), so its layout can be
 * judged before the first real one is entered (Homepage → Voices in the CMS).
 * Development only: Testimonials.tsx never uses them in a production build,
 * so nothing invented can reach the live site. Every attribution says it is a
 * placeholder.
 */
export function placeholderQuotes(locale: string): CmsTestimonial[] {
    if (locale === 'de') {
        return [
            {
                quote: 'Vorher haben wir mit Excel-Listen und Telefonketten gearbeitet. Heute läuft das in einer App, die unser Team wirklich nutzt – und wir haben wieder Zeit für unsere eigentliche Arbeit.',
                name: 'Vorname Nachname',
                role: 'Geschäftsführung',
                organisation: 'Partner-NGO (Platzhalter)',
                audience: 'ngo',
            },
            {
                quote: 'Die Studierenden arbeiten wie ein gutes Produktteam: schnell, gründlich und mit echtem Interesse daran, was die Software bewirkt.',
                name: 'Vorname Nachname',
                role: 'Head of Engineering',
                organisation: 'Partnerunternehmen (Platzhalter)',
                audience: 'company',
            },
            {
                quote: 'In einem Semester habe ich mehr gelernt als in jeder Vorlesung – und am Ende nutzt eine echte Organisation, was wir gebaut haben.',
                name: 'Vorname Nachname',
                role: 'Mitglied',
                organisation: 'Informatik (Platzhalter)',
                audience: 'member',
            },
        ];
    }
    return [
        {
            quote: 'We used to run everything on spreadsheets and phone chains. Now it lives in an app our team actually uses – and we have time again for the work we are here for.',
            name: 'First Last',
            role: 'Managing Director',
            organisation: 'Partner NGO (placeholder)',
            audience: 'ngo',
        },
        {
            quote: 'The students work like a good product team: fast, thorough and genuinely interested in what the software changes.',
            name: 'First Last',
            role: 'Head of Engineering',
            organisation: 'Partner company (placeholder)',
            audience: 'company',
        },
        {
            quote: 'I learned more in one semester than in any lecture – and at the end, a real organisation uses what we built.',
            name: 'First Last',
            role: 'Member',
            organisation: 'Computer Science (placeholder)',
            audience: 'member',
        },
    ];
}
