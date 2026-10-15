import { useEffect, useState } from 'react';
import { useSiteFlags } from '@/api/SiteFlagsContext';

/**
 * The current time, for anything that depends on the application round's
 * dates (is the form open, how many days are left). Seeded with the request
 * time the root layout captured, so the server HTML and the first client
 * render agree (no hydration mismatch on the day count); the client clock
 * takes over after mount. Same approach as the Join page's `serverNow` prop.
 */
export default function useNow(): number {
    const { serverNow } = useSiteFlags();
    const [now, setNow] = useState(serverNow);
    useEffect(() => {
        setNow(Date.now());
    }, []);
    return now;
}
