import React from 'react';

/** A case-study section's head: the mono `~/path` kicker, the heading and an
 *  optional lead, always above the content. */
const CaseStudyHead: React.FC<{
    kicker?: string | null;
    heading?: string | null;
    lead?: string | null;
}> = ({ kicker, heading, lead }) => {
    if (!kicker && !heading && !lead) return null;
    return (
        <header className="lp-cs-head">
            {kicker && <p className="lp-kicker lp-cs-head__kicker">{kicker}</p>}
            {heading && <h2 className="lp-h2 lp-cs-head__h">{heading}</h2>}
            {lead && <p className="lp-cs-head__lead">{lead}</p>}
        </header>
    );
};

export default CaseStudyHead;
