#!/usr/bin/env node
/**
 * Bring the live "techtour" form in line with how the TechTour now works: the
 * host company of each evening sees the registrations for its evening and
 * decides who attends (Datenschutz section 5 – apply it with
 * upsert-content.mjs in the same sitting).
 *
 *   CMS_URL=https://codingforchange.com CMS_EMAIL=… CMS_PASSWORD=… \
 *     node scripts/techtour-host-sharing.mjs            # dry run: shows the changes, writes nothing
 *     node scripts/techtour-host-sharing.mjs --apply    # writes English and German, reads back to verify
 *
 * Unlike upsert-forms.mjs, which replaces every question with the definitions
 * in lib/formDefinitions.mjs, this changes three things and nothing else:
 *
 *   1. adds the required "the host company sees my registration" box
 *      (`hostSharing`) right before the privacy box, in both languages;
 *   2. replaces the confirmation message if it is still the original one, which
 *      promised the details of every evening (any other wording is left alone);
 *   3. names each evening option after the company the TechTour page shows on
 *      that date, in both languages. /techtour/apply draws the rows from the
 *      page and matches them to the options by date, so a visitor ticks the
 *      row they see – but the answer stores the option's label, and that label
 *      is what the team and the host companies go by. When the page and the
 *      option disagree (two companies swapped days), the stored answer names
 *      the wrong company. The option keys (`value`) never change.
 *
 * Every other question is sent back exactly as it was read, per language, so
 * whatever was edited in the admin stays. Safe to re-run.
 */
import { techtourForm } from './lib/formDefinitions.mjs';

const BASE = (process.env.CMS_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.CMS_EMAIL;
const PASSWORD = process.env.CMS_PASSWORD;
const APPLY = process.argv.includes('--apply');
const FORM_TITLE = 'techtour';

/** The confirmation the form was set up with (formDefinitions.mjs before October 2026). */
const ORIGINAL_CONFIRMATION = {
  en: 'You are registered! We will email you the details for each evening as soon as times and locations are confirmed.',
  de: 'Du bist angemeldet! Sobald Uhrzeiten und Orte feststehen, schicken wir dir die Details zu jedem Abend per E-Mail.',
};

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

const req = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${(await res.text()).slice(0, 400)}`);
  return res.json();
};

// `fallback-locale=none`: read each language as stored. With the fallback a
// missing German label comes back in English, and sending that back would
// write the English text into the German version for good.
const read = (id, locale) => req('GET', `/api/forms/${id}?locale=${locale}&fallback-locale=none&depth=0`);

const plain = (node) =>
  !node
    ? ''
    : node.type === 'text'
      ? node.text ?? ''
      : (node.children ?? []).map(plain).join('');

// Evening labels, in the style already on the form: "Wed 11 Nov · QuantCo",
// "Mi 11. Nov · QuantCo".
const WEEKDAYS = { Mon: 'Mo', Tue: 'Di', Wed: 'Mi', Thu: 'Do', Fri: 'Fr', Sat: 'Sa', Sun: 'So' };
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const TBA = { en: 'Company to be announced', de: 'Unternehmen wird noch bekannt gegeben' };

/** Day of month and month (0-11) an option label names, e.g. "Wed 11 Nov · …" → { day: 11, month: 10 }. */
const labelDate = (label) => {
  const m = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{1,2}) ([A-Z][a-z]{2}) · /.exec((label ?? '').trim());
  const month = m ? MONTHS_EN.indexOf(m[2]) : -1;
  return month === -1 ? null : { day: Number(m[1]), month };
};

/** The page's evenings keyed "day-month" (Munich time), each with its label in both languages. */
const eveningLabels = (events) => {
  const byDay = new Map();
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', weekday: 'short', day: 'numeric', month: 'numeric' });
  for (const ev of events ?? []) {
    if (!ev?.date) continue;
    const p = Object.fromEntries(parts.formatToParts(new Date(ev.date)).map((x) => [x.type, x.value]));
    const day = Number(p.day);
    const month = Number(p.month) - 1;
    const tba = ev.status === 'tba' || !ev.company?.trim() || /^tba$/i.test(ev.company.trim());
    const who = (locale) => (tba ? TBA[locale] : ev.company.trim());
    byDay.set(`${day}-${month}`, {
      en: `${p.weekday} ${day} ${MONTHS_EN[month]} · ${who('en')}`,
      de: `${WEEKDAYS[p.weekday]} ${day}. ${MONTHS_DE[month]} · ${who('de')}`,
    });
  }
  return byDay;
};

const forms = await req('GET', '/api/forms?limit=100&depth=0&locale=en&fallback-locale=none');
const found = (forms.docs ?? []).find((f) => f.title?.trim().toLowerCase() === FORM_TITLE);
if (!found) {
  console.error(`No form titled "${FORM_TITLE}" on ${BASE}.`);
  process.exit(1);
}
const id = found.id;
const wanted = { en: techtourForm('en'), de: techtourForm('de') };
const boxOf = (def) => def.fields.find((f) => f.name === 'hostSharing');

console.log(`Form "${FORM_TITLE}" (id ${id}) on ${BASE}${APPLY ? '' : ' — DRY RUN'}`);

const page = await req('GET', '/api/globals/tech-tour?locale=en&depth=0');
const evenings = eveningLabels(page?.events);

/** The planned EN and DE bodies, and what they change. */
const plan = (en, de, newBlockId) => {
  const changes = [];
  const enFields = [...(en.fields ?? [])];
  const deFields = [...(de.fields ?? [])];

  // 1. The host-sharing box.
  const at = enFields.findIndex((f) => f.name === 'hostSharing');
  if (at === -1) {
    const privacy = enFields.findIndex((f) => f.name === 'privacy');
    const pos = privacy === -1 ? enFields.length : privacy;
    const { blockType, name, required } = boxOf(wanted.en);
    enFields.splice(pos, 0, { blockType, name, required, label: boxOf(wanted.en).label, ...(newBlockId ? { id: newBlockId } : {}) });
    deFields.splice(pos, 0, { blockType, name, required, label: boxOf(wanted.de).label, ...(newBlockId ? { id: newBlockId } : {}) });
    changes.push(`add the required "hostSharing" box before ${privacy === -1 ? 'the end' : '"privacy"'} (en + de)`);
  } else if (!deFields[at]?.label) {
    deFields[at] = { ...deFields[at], label: boxOf(wanted.de).label };
    changes.push('give the existing "hostSharing" box its German label');
  }

  // 3. Evening options named after the page's company on that date.
  enFields.forEach((block, i) => {
    if (block.blockType !== 'checkboxGroup') return;
    const enOptions = [];
    const deOptions = [];
    (block.options ?? []).forEach((o, j) => {
      const deOption = deFields[i]?.options?.[j] ?? o;
      const date = labelDate(o.label);
      const evening = date && evenings.get(`${date.day}-${date.month}`);
      if (!evening) {
        if (date) changes.push(`! option "${o.value}" ("${o.label}"): no evening on that date on the TechTour page — left alone`);
        enOptions.push(o);
        deOptions.push(deOption);
        return;
      }
      if (o.label !== evening.en) changes.push(`[en] option "${o.value}": "${o.label}" → "${evening.en}"`);
      if (deOption.label !== evening.de) changes.push(`[de] option "${o.value}": "${deOption.label ?? '(none – shows the English one)'}" → "${evening.de}"`);
      enOptions.push({ ...o, label: evening.en });
      deOptions.push({ ...deOption, label: evening.de });
    });
    enFields[i] = { ...block, options: enOptions };
    deFields[i] = { ...deFields[i], options: deOptions };
  });

  // 2. The confirmation message.
  const confirmation = {};
  for (const [locale, doc] of [['en', en], ['de', de]]) {
    const text = plain(doc.confirmationMessage?.root).trim();
    const next = plain(wanted[locale].confirmationMessage.root).trim();
    if (text === ORIGINAL_CONFIRMATION[locale]) {
      confirmation[locale] = wanted[locale].confirmationMessage;
      changes.push(`[${locale}] confirmation message → "${next}"`);
    } else if (text !== next) {
      changes.push(`= [${locale}] confirmation message was edited in the admin, left alone. Suggested: "${next}"`);
    }
  }
  return { enFields, deFields, confirmation, changes };
};

const [en, de] = [await read(id, 'en'), await read(id, 'de')];
const first = plan(en, de);
for (const c of first.changes) console.log(`  ${c.startsWith('=') || c.startsWith('!') ? c : `+ ${c}`}`);
const writes = first.changes.filter((c) => !c.startsWith('=') && !c.startsWith('!'));
if (writes.length === 0) {
  console.log('Nothing to change.');
  process.exit(0);
}
if (!APPLY) {
  console.log('\nDry run — nothing written. Re-run with --apply to save.');
  process.exit(0);
}

// English first: it creates the new block and gives it its id, which the
// German write must reuse – block rows are matched across languages by id.
const savedEn = (
  await req('PATCH', `/api/forms/${id}?locale=en`, {
    fields: first.enFields,
    ...(first.confirmation.en ? { confirmationMessage: first.confirmation.en } : {}),
  })
).doc;
const newBlockId = savedEn.fields.find((f) => f.name === 'hostSharing')?.id;
const deFields = first.deFields.map((f) => (f.name === 'hostSharing' && !f.id ? { ...f, id: newBlockId } : f));
await req('PATCH', `/api/forms/${id}?locale=de`, {
  fields: deFields,
  ...(first.confirmation.de ? { confirmationMessage: first.confirmation.de } : {}),
});

// Read back: a second plan must find nothing left to do, and every block that
// was there before must still carry the same labels in both languages.
const [enAfter, deAfter] = [await read(id, 'en'), await read(id, 'de')];
const again = plan(enAfter, deAfter).changes.filter((c) => !c.startsWith('=') && !c.startsWith('!'));
const lost = [];
for (const [before, after, locale] of [[en, enAfter, 'en'], [de, deAfter, 'de']]) {
  for (const block of before.fields ?? []) {
    const now = (after.fields ?? []).find((f) => f.id === block.id);
    if (!now) lost.push(`[${locale}] block "${block.name}" is gone`);
    else if ((now.label ?? null) !== (block.label ?? null)) lost.push(`[${locale}] "${block.name}" label changed`);
  }
}
if (again.length || lost.length) {
  console.error(`  ✗ saved, but: ${[...again, ...lost].join('; ')}`);
  process.exit(1);
}
console.log('  ✓ saved and verified (en + de)');
