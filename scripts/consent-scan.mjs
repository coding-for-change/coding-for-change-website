#!/usr/bin/env node
/**
 * Consent scanner — our replacement for a hosted CMP's cookie crawler.
 *
 * We self-host Klaro, so nobody is watching for trackers that got added without
 * being declared in the consent config. A hosted CMP would crawl the live site
 * and email us afterwards; this fails the build instead, which is strictly
 * better — the tracker never reaches production.
 *
 * It scans source for the three ways a tracker sneaks in:
 *   1. a script/iframe pointing at an external host
 *   2. a `document.cookie =` write
 *   3. a `localStorage` / `sessionStorage` write
 *
 * Anything not in the allowlist below is a failure. Adding to the allowlist is
 * meant to be a deliberate act that comes with declaring the thing in
 * `inner/src/lib/klaroConfig.ts` and in the Datenschutz — see the consent section
 * of CLAUDE.md.
 *
 * This is a static scan, so it is a guardrail and not a proof. Known blind spots:
 * a cookie set by a third party at runtime, a host assembled from string
 * fragments, and a storage key passed as a variable rather than a literal (only
 * literal keys are matched). A headless runtime check is the follow-up if we want
 * to close those.
 *
 * Usage: node scripts/consent-scan.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN_DIRS = ['inner/src', 'outer/src'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.html']);

/**
 * External hosts we knowingly contact, and why. A host here still needs a Klaro
 * service unless it provably sets no storage.
 */
const ALLOWED_HOSTS = new Map([
    ['use.typekit.net', 'Adobe Fonts stylesheet — CSS only, sets no storage'],
    ['p.typekit.net', 'Adobe Fonts — preconnect only'],
    ['www.googletagmanager.com', 'gtag.js — declared: analytics + google-ads services'],
    ['business.safety.google', 'Link target only (Google audit criterion 5)'],
    ['app.cal.com', 'Booking embed — user-initiated, declared in Datenschutz'],
    ['cal.com', 'Booking embed / link target'],
    ['calendar.google.com', 'Google Calendar appointment-schedule fallback embed'],
    ['fonts.googleapis.com', 'next/font — self-hosted at build time, no runtime call'],
    ['fonts.gstatic.com', 'next/font — self-hosted at build time, no runtime call'],
    ['schema.org', 'JSON-LD vocabulary URL, never fetched'],
    ['www.w3.org', 'SVG/XML namespace URI in markup — an identifier, never fetched'],
    ['cms', 'Internal Docker service hostname; server-side SSR fetches only'],
    ['github.com', 'Outbound link target'],
    ['www.instagram.com', 'Outbound link target'],
    ['www.linkedin.com', 'Outbound link target'],
    ['codingforchange.com', 'Our own origin'],
    ['www.codingforchange.com', 'Our own origin'],
]);

/** Storage keys we knowingly write, each gated on consent where required. */
const ALLOWED_STORAGE_KEYS = new Map([
    // NOTE: cfc.attribution / cfc.visitor / cfc.session / cfc.landed were
    // REMOVED, not forgotten. Our visitor counting now keeps state in page
    // memory so it needs no consent (see inner/src/lib/attribution.ts). They are
    // deliberately absent from this allowlist so that reintroducing any of them
    // fails the build — putting that storage back would silently drag the whole
    // subsystem back under TDDDG § 25 and, with it, back to near-zero data.
    ['cfc_consent', 'Klaro consent cookie — strictly necessary'],
    ['cfc_consent_id', 'Consent record id — strictly necessary (Art. 7(1) proof)'],
    // Language preference. Strictly necessary and consent-exempt: it stores a
    // choice the visitor actively made in order to deliver the site in the
    // language they asked for (EDPB WP194 "user-input"/preference cookies).
    // Still must appear in the Datenschutz cookie table.
    ['cfc-locale', 'Locale preference — strictly necessary, consent-exempt'],
    // "Already watched the TechTour intro" flag (localStorage). A yes/no about
    // a UI state the visitor reached, no identifier, read only by the TechTour
    // page: user-preference storage, consent-exempt like cfc-locale. Declared
    // in klaroConfig's "site basics" text and in the Datenschutz storage list.
    ['cfc-techtour-intro', 'TechTour intro seen — strictly necessary, consent-exempt'],
]);

/** Cookie writes are rare enough to enumerate by the file that does them. */
const ALLOWED_COOKIE_WRITERS = new Set([
    'inner/src/lib/consentRecord.ts', // cfc_consent_id, strictly necessary
    // cfc-locale: mirrors the chosen language so SSR renders in it. Strictly
    // necessary for the requested service, so consent-exempt.
    'inner/src/contexts/LanguageContext.tsx',
]);

const findings = [];

function walk(dir) {
    let entries;
    try {
        entries = readdirSync(dir);
    } catch {
        return; // directory absent in this checkout — nothing to scan
    }
    for (const entry of entries) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        // Vendored third-party bundles are reviewed on update (see their README),
        // not line-scanned: minified code is full of strings that look like hosts
        // and would drown the real findings in noise.
        if (entry === 'vendor') continue;
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            walk(full);
        } else if (EXTENSIONS.has(extname(entry))) {
            scan(full);
        }
    }
}

function scan(file) {
    const rel = relative(ROOT, file);
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');

    lines.forEach((line, i) => {
        const at = `${rel}:${i + 1}`;

        // 1. External hosts.
        for (const match of line.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
            const host = match[1].toLowerCase();
            if (!ALLOWED_HOSTS.has(host)) {
                findings.push(
                    `${at}  undeclared external host "${host}"\n` +
                        `      → declare a Klaro service for it (inner/src/lib/klaroConfig.ts),\n` +
                        `        disclose it in the Datenschutz, then add it to ALLOWED_HOSTS here.`
                );
            }
        }

        // 2. Cookie writes.
        if (/document\s*\.\s*cookie\s*=/.test(line) && !ALLOWED_COOKIE_WRITERS.has(rel)) {
            findings.push(
                `${at}  writes document.cookie from a file that isn't an allowed cookie writer\n` +
                    `      → a cookie needs consent unless strictly necessary. Gate it, then add\n` +
                    `        this file to ALLOWED_COOKIE_WRITERS with the reason.`
            );
        }

        // 3. Storage writes with a literal key.
        for (const match of line.matchAll(
            /(?:local|session)Storage\s*\.\s*(?:setItem|removeItem)\s*\(\s*['"`]([^'"`]+)['"`]/g
        )) {
            const key = match[1];
            if (!ALLOWED_STORAGE_KEYS.has(key)) {
                findings.push(
                    `${at}  undeclared storage key "${key}"\n` +
                        `      → TDDDG § 25 covers any device storage. Gate it on consent, then add\n` +
                        `        it to ALLOWED_STORAGE_KEYS here with its legal basis.`
                );
            }
        }
    });
}

for (const dir of SCAN_DIRS) walk(join(ROOT, dir));

if (findings.length > 0) {
    console.error(
        `\nConsent scan failed — ${findings.length} undeclared item(s).\n` +
            `Nothing may store data on a visitor's device before they consent.\n`
    );
    for (const f of findings) console.error(`  ${f}\n`);
    console.error(
        'See the "Consent — REQUIRED process" section of CLAUDE.md before allowlisting anything.\n'
    );
    process.exit(1);
}

console.log('Consent scan passed — no undeclared hosts, cookies or storage keys.');
