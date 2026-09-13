#!/usr/bin/env node
/**
 * Apply the Datenschutz edits for the application forms + Munich TechTour to
 * a running CMS (Legal global → Privacy Policy, English and German). The edits
 * are structural and idempotent — see scripts/lib/privacyEdits.mjs; the texts
 * are the ones in GO-LIVE-RUNBOOK.md §7.
 *
 *   CMS_URL=https://codingforchange.com CMS_EMAIL=… CMS_PASSWORD=… \
 *     node scripts/upsert-content.mjs                 # dry run: shows what would change, writes nothing
 *     node scripts/upsert-content.mjs --apply         # writes both locales
 *
 * Options (decisions for the association, see the runbook):
 *   --share-names      say that attendee names may be passed to a host company for
 *                      building access (default: say they are not passed on)
 *   --transfer=dpf     name the EU–US Data Privacy Framework as the basis for the
 *                      email provider's US transfer (default: scc = Standard
 *                      Contractual Clauses) — check Resend's DPA before choosing
 *   --locale=en|de     only one language (default: both)
 *
 * The TechTour page content and the forms are handled by upsert-forms.mjs.
 */
import { applyPrivacyEdits, headings, sectionText } from './lib/privacyEdits.mjs';

const BASE = (process.env.CMS_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.CMS_EMAIL;
const PASSWORD = process.env.CMS_PASSWORD;
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const options = {
  shareNames: args.includes('--share-names'),
  transfer: opt('transfer', 'scc'),
};
const locales = opt('locale', 'en,de').split(',').map((l) => l.trim()).filter(Boolean);
if (!['scc', 'dpf'].includes(options.transfer)) {
  console.error('--transfer must be scc or dpf');
  process.exit(1);
}
if (!EMAIL || !PASSWORD) {
  console.error('Set CMS_EMAIL and CMS_PASSWORD (an admin user of the CMS).');
  process.exit(1);
}

const login = await fetch(`${BASE}/api/users/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!login.ok) {
  console.error(`Login failed: ${login.status} ${await login.text()}`);
  process.exit(1);
}
const cookie = (login.headers.getSetCookie?.() || [])
  .find((c) => c.startsWith('payload-token='))
  ?.split(';')[0];
if (!cookie) {
  console.error('Login succeeded but no payload-token cookie was returned.');
  process.exit(1);
}
const headers = { cookie, 'content-type': 'application/json' };

console.log(`Datenschutz edits on ${BASE} — options: shareNames=${options.shareNames}, transfer=${options.transfer}${APPLY ? '' : ' — DRY RUN'}`);

let failed = false;
for (const locale of locales) {
  const res = await fetch(`${BASE}/api/globals/legal?locale=${locale}&depth=0`, { headers: { cookie } });
  if (!res.ok) {
    console.error(`[${locale}] could not load the Legal global: ${res.status}`);
    failed = true;
    continue;
  }
  const legal = await res.json();
  const doc = legal?.privacyPolicy;
  if (!doc?.root?.children) {
    console.error(`[${locale}] the Legal global has no privacy policy text yet — write it in the admin first`);
    failed = true;
    continue;
  }

  const { doc: next, changes, skipped } = applyPrivacyEdits(doc, locale, options);
  console.log(`\n[${locale}] ${headings(doc).length} headings before, ${headings(next).length} after`);
  for (const c of changes) console.log(`  + ${c}`);
  for (const s of skipped) console.log(`  = ${s}`);
  if (changes.length === 0) continue;

  const preview = sectionText(next, (h) => /^5\./.test(h));
  if (preview) console.log(`  preview of section 5:\n    ${preview.split('\n')[0]}\n    ${preview.split('\n')[1]?.slice(0, 160)}…`);

  if (!APPLY) continue;
  const save = await fetch(`${BASE}/api/globals/legal?locale=${locale}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ privacyPolicy: next }),
  });
  if (!save.ok) {
    console.error(`  ✗ save failed: ${save.status} ${(await save.text()).slice(0, 300)}`);
    failed = true;
    continue;
  }
  // Read back and prove the edits landed.
  const check = await (await fetch(`${BASE}/api/globals/legal?locale=${locale}&depth=0`, { headers: { cookie } })).json();
  const again = applyPrivacyEdits(check.privacyPolicy, locale, options);
  console.log(again.changes.length === 0 ? '  ✓ saved and verified' : `  ✗ saved, but a re-run still wants to change: ${again.changes.join('; ')}`);
  if (again.changes.length) failed = true;
}

if (!APPLY) console.log('\nDry run — nothing written. Re-run with --apply to save.');
process.exit(failed ? 1 : 0);
