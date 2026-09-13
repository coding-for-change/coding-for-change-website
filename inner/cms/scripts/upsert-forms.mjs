#!/usr/bin/env node
/**
 * Set up (or reset) the "application" and "techtour" forms on a running CMS,
 * and give the TechTour page starting content if it is empty.
 *
 *   CMS_URL=https://codingforchange.com CMS_EMAIL=… CMS_PASSWORD=… \
 *     node scripts/upsert-forms.mjs            # shows what exists, writes nothing
 *     node scripts/upsert-forms.mjs --apply    # creates / replaces the forms
 *
 * WARNING: --apply replaces the FIELDS of an existing form with the definitions
 * in scripts/lib/formDefinitions.mjs. Existing submissions are not touched.
 * After the first run, edit questions in the admin (Forms) — or change the
 * definitions and re-run.
 */
import { upsertForms } from './lib/upsertForms.mjs';

const BASE = (process.env.CMS_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.CMS_EMAIL;
const PASSWORD = process.env.CMS_PASSWORD;
const APPLY = process.argv.includes('--apply');

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

await upsertForms({
  base: BASE,
  cookie,
  toEmail: process.env.CONTACT_TO_EMAIL || 'info@codingforchange.com',
  fromEmail: process.env.EMAIL_FROM || 'noreply@codingforchange.com',
  dryRun: !APPLY,
});
