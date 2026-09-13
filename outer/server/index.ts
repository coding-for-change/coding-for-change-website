const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = process.env.PORT || 8080;

const CMS_URL = process.env.CMS_URL || 'http://cms:3000';
const INNER_URL = process.env.INNER_URL || 'http://inner:80';
const PUBLIC_DIR = path.resolve(__dirname, '../public');

app.use(cors());
app.use(
    compression({
        filter: (req, res) => {
            const contentType = res.getHeader('Content-Type');
            if (
                typeof contentType === 'string' &&
                contentType.includes('text/event-stream')
            ) {
                return false;
            }
            return compression.filter(req, res);
        },
    })
);

// Security response headers (Lighthouse "Trust & Safety"). Set before the
// proxies so they apply to every response on this origin — the inner site,
// the CMS admin/API, and the 3D scene alike.
app.use((req, res, next) => {
    // HSTS: pin the origin to HTTPS for a year. Per spec, browsers ignore this
    // header when it arrives over plain HTTP, so sending it unconditionally is
    // safe even though TLS is terminated upstream. `includeSubDomains` requires
    // every *.codingforchange.com host to also be HTTPS — drop it if any
    // subdomain is still served over plain HTTP.
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Clickjacking: only same-origin documents may frame the site. The 3D scene
    // (/3d) embeds the inner site from this same origin, so SAMEORIGIN keeps
    // that working while blocking foreign framers.
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // Block MIME-sniffing a response into an unintended content type.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Send only the origin (no path/query) on cross-origin navigations.
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Isolate this browsing-context group from cross-origin openers while still
    // allowing "open in new tab" links (cal.com, socials) to work.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
});

// Proxy: Payload CMS (admin, API, assets, media)
app.use(
    ['/admin', '/api', '/media'],
    createProxyMiddleware({
        target: CMS_URL,
        changeOrigin: true,
        // Preserve the original path (don't strip the mount prefix)
        pathRewrite: (reqPath, req) => req.originalUrl,
    })
);

// `/_next` is served by BOTH Next apps — the CMS admin panel and the inner
// site. The path alone is ambiguous, so route by the requesting document:
// admin asset/RSC requests carry an `/admin` referer; everything else is the
// inner site (the default). Without this split, the inner app's JS/CSS chunks
// would be fetched from the CMS and 404.
app.use(
    '/_next',
    createProxyMiddleware({
        changeOrigin: true,
        target: INNER_URL,
        router: (req) =>
            /\/admin(\/|$|\?)/.test(req.headers.referer || '')
                ? CMS_URL
                : INNER_URL,
        pathRewrite: (reqPath, req) => req.originalUrl,
    })
);

// The inner desktop OS used to be embedded under /inner/. It is now the
// site itself, served at /. Permanently redirect old links and bookmarks.
app.use('/inner', (req, res) => {
    // req.url is the path after the /inner mount point (e.g. "/about").
    res.redirect(301, req.url);
});

// On phones the 3D scene is too heavy and its pointer/keyboard controls
// don't map to touch, so the "enhanced experience" isn't offered on
// mobile — those visitors are sent straight to the fast content site.
// Express only sees the User-Agent here (no viewport), so this device
// check is UA-based; every in-app layout decision uses the viewport.
const MOBILE_UA =
    /Android.*Mobile|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile Safari/i;

app.use('/3d', (req, res, next) => {
    if (MOBILE_UA.test(req.headers['user-agent'] || '')) {
        // Preserve the query string so campaign tags (?src=/utm_*) survive the
        // bounce to the content site — otherwise a mobile visitor who scans a
        // QR/poster pointing at /3d loses their traffic-source attribution.
        const q = req.originalUrl.indexOf('?');
        return res.redirect(302, q === -1 ? '/' : `/${req.originalUrl.slice(q)}`);
    }
    next();
});

// The 3D scene is the opt-in "enhanced experience", served at /3d. Its
// webpack build sets publicPath to '/3d/', so every asset request arrives
// under /3d. noindex keeps it from competing with the content site (/)
// for search rankings.
app.use('/3d', (req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
});
app.use('/3d', express.static(PUBLIC_DIR));
app.use('/3d', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// SEO: serve a real text/plain robots.txt before the catch-all
app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(
        'User-agent: *\nAllow: /\n\nSitemap: https://codingforchange.com/sitemap.xml\n'
    );
});

// Fetch a CMS collection's docs for the sitemap (we use `slug` + `updatedAt`).
// Returns null when the CMS can't be reached so callers can fail open — a
// transient CMS blip keeps the list pages in the sitemap rather than dropping
// real pages, while emitting no bogus detail URLs.
const cmsDocs = async (slug) => {
    try {
        const res = await fetch(
            `${CMS_URL}/api/${slug}?limit=500&depth=0&sort=-updatedAt`,
            { signal: AbortSignal.timeout(4000) }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return Array.isArray(data.docs) ? data.docs : [];
    } catch {
        return null;
    }
};

// Fetch a CMS global (we use `updatedAt` for lastmod). null on any failure.
const cmsGlobal = async (slug) => {
    try {
        const res = await fetch(`${CMS_URL}/api/globals/${slug}?depth=0`, {
            signal: AbortSignal.timeout(4000),
        });
        return res.ok ? await res.json() : null;
    } catch {
        return null;
    }
};

// Normalise a CMS timestamp to YYYY-MM-DD, or null if missing/invalid.
const isoDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};


app.get('/sitemap.xml', async (req, res) => {
    const ORIGIN = 'https://codingforchange.com';
    const today = new Date().toISOString().slice(0, 10);

    // Projects drive both a list page and per-item detail pages;
    // events + sponsors only gate their own list page (no detail routes).
    const [projects, events, sponsors, techTour] = await Promise.all([
        cmsDocs('projects'),
        cmsDocs('events'),
        cmsDocs('sponsors'),
        cmsGlobal('tech-tour'),
    ]);
    // null → CMS unreachable → fail open (keep the list page listed).
    const has = (docs) => docs === null || docs.length > 0;

    const entries = [];
    const add = (route, priority, lastmod) =>
        entries.push({ route, priority, lastmod: lastmod || today });

    // Static pages + content list pages.
    add('/', '1.0');
    if (has(projects)) add('/projects', '0.8');
    if (has(events)) add('/events', '0.8');
    if (has(sponsors)) add('/sponsors', '0.8');
    add('/partner', '0.8');
    add('/team', '0.8');
    add('/qa', '0.7');
    add('/join', '0.8');
    // The Munich TechTour event page; lastmod follows the CMS content edits.
    add('/techtour', '0.8', isoDate(techTour?.updatedAt));
    add('/contact', '0.7');
    add('/imprint', '0.3');
    add('/privacy', '0.3');

    // Detail pages. A project needs a slug to have a detail route (see
    // projects/[slug]); it 404s if the doc is missing, so we only ever list
    // slugs the CMS actually has.
    (projects || [])
        .filter((p) => p.slug)
        .forEach((p) =>
            add(`/projects/${encodeURIComponent(p.slug)}`, '0.7', isoDate(p.updatedAt))
        );

    const urls = entries
        .map(
            ({ route, priority, lastmod }) =>
                `  <url><loc>${ORIGIN}${route}</loc><lastmod>${lastmod}</lastmod><priority>${priority}</priority></url>`
        )
        .join('\n');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`);
});

// Everything else: the inner desktop OS is the default experience.
// Proxy all remaining routes to the inner nginx, which serves the SPA.
app.use(
    '/',
    createProxyMiddleware({
        target: INNER_URL,
        changeOrigin: true,
        pathRewrite: (reqPath, req) => req.originalUrl,
    })
);

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
