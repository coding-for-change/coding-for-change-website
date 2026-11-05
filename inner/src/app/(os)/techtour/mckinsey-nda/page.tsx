import TechTourNda from '@/components/showcase/TechTourNda';
import type { Metadata } from 'next';

/**
 * McKinsey's confidentiality agreement for its Tech Tour evening, reached from
 * the to-do on a registrant's own page (/techtour/manage). Not indexed: it is
 * there to be read before ticking, not to be found.
 */
export const metadata: Metadata = {
    title: 'Confidentiality agreement – McKinsey QuantumBlack – Munich Tech Tour – Coding for Change',
    robots: { index: false, follow: false },
};

export default function TechTourNdaPage() {
    return <TechTourNda />;
}
