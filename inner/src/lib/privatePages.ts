/**
 * Pages reached through a personal link, where the address itself is the key
 * (`/techtour/manage?token=…`), and pages about one signed-in person (a new
 * member's `/onboarding`). The Google tag stays off them: its page view
 * would send the whole address, token included, to Google – with or without
 * consent, since Advanced Consent Mode still pings while denied – and a
 * member's own page is nobody's business but theirs. Both carry noindex.
 *
 * middleware.ts marks such a request with NO_TAGS_HEADER; GoogleTag.tsx
 * renders nothing when it sees it.
 */

export const NO_TAGS_HEADER = 'x-cfc-no-tags';

const PRIVATE_PATHS = ['/techtour/manage', '/onboarding'];

export const isPrivatePath = (pathname: string): boolean =>
    PRIVATE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
