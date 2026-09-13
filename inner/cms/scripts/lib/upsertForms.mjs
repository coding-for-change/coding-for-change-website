import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationForm, techtourForm, techTourGlobal } from './formDefinitions.mjs';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'techtour');

/** Company logos shipped with the repo, matched to events by company name. */
const LOGOS = [
  { match: /^lio$/i, file: 'lio.png', alt: 'Lio logo' },
  { match: /quantumblack/i, file: 'mckinsey-quantumblack.png', alt: 'McKinsey QuantumBlack logo' },
  { match: /^quantco$/i, file: 'quantco.png', alt: 'QuantCo logo' },
];

/**
 * Upload the bundled company logos to `media` and set them as the `logo` of
 * every TechTour event whose company matches, unless that event already has
 * one. Safe to re-run; logs and skips when an asset file is missing.
 */
export async function attachTechTourLogos({ base, cookie, log = console.log }) {
  const auth = { cookie };
  const get = async (p) => {
    const r = await fetch(`${base}${p}`, { headers: auth });
    if (!r.ok) throw new Error(`GET ${p} → ${r.status}`);
    return r.json();
  };
  const page = await get('/api/globals/tech-tour?locale=en&depth=0');
  const events = page?.events ?? [];
  if (events.length === 0) {
    log('tech-tour page has no events yet — logos not attached');
    return 0;
  }
  let attached = 0;
  const updates = [];
  for (const ev of events) {
    const logo = LOGOS.find((l) => l.match.test((ev.company || '').trim()));
    if (!logo || ev.logo) { updates.push({ id: ev.id }); continue; }
    const file = path.join(ASSETS, logo.file);
    if (!existsSync(file)) { log(`logo file missing: ${file}`); updates.push({ id: ev.id }); continue; }
    const body = new FormData();
    body.append('file', new Blob([await readFile(file)], { type: 'image/png' }), logo.file);
    body.append('_payload', JSON.stringify({ alt: logo.alt }));
    const r = await fetch(`${base}/api/media`, { method: 'POST', headers: auth, body });
    if (!r.ok) throw new Error(`POST /api/media (${logo.file}) → ${r.status} ${(await r.text()).slice(0, 200)}`);
    const { doc } = await r.json();
    updates.push({ id: ev.id, logo: doc.id });
    attached += 1;
  }
  if (attached > 0) {
    // Array rows are matched by id, so sending only ids + the new logo leaves
    // every other field (both locales) untouched.
    const r = await fetch(`${base}/api/globals/tech-tour?locale=en`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ events: updates }),
    });
    if (!r.ok) throw new Error(`POST /api/globals/tech-tour (logos) → ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  log(`tech-tour logos: ${attached} attached`);
  return attached;
}

/**
 * Create or update the "application" and "techtour" forms (EN + DE) and, if the
 * TechTour page global is still empty, give it starting content. Shared by the
 * dev seed and the production `upsert-forms.mjs` CLI.
 *
 * Forms are matched by title. An existing form's fields are REPLACED by the
 * definitions (that is the point of running this), so run it once to set the
 * forms up, then edit in the admin — or edit `formDefinitions.mjs` and re-run.
 *
 * Two passes because each form's "also …" checkbox points at the other form:
 * both must exist before the subform blocks can reference them.
 */
export async function upsertForms({ base, cookie, toEmail, fromEmail, log = console.log, dryRun = false }) {
  const headers = { 'content-type': 'application/json', cookie };
  const req = async (method, path, body) => {
    const res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 400)}`);
    }
    return res.json();
  };

  const existing = (await req('GET', '/api/forms?limit=100&depth=0&locale=en')).docs ?? [];
  const byTitle = (title) => existing.find((f) => f.title?.trim().toLowerCase() === title);
  const current = { application: byTitle('application'), techtour: byTitle('techtour') };
  log(`forms: application ${current.application ? `exists (id ${current.application.id})` : 'missing'}, techtour ${current.techtour ? `exists (id ${current.techtour.id})` : 'missing'}`);
  if (dryRun) {
    log('dry run — nothing written. Re-run with --apply to create/update.');
    return current;
  }

  // Pass 1 (EN, without the cross-reference blocks): create or update.
  const upsertEn = async (title, body) => {
    const doc = current[title];
    if (doc) {
      const r = await req('PATCH', `/api/forms/${doc.id}?locale=en`, body);
      return r.doc;
    }
    const r = await req('POST', '/api/forms?locale=en', body);
    return r.doc;
  };
  const opts = { toEmail, fromEmail };
  let app = await upsertEn('application', applicationForm('en', opts));
  let tt = await upsertEn('techtour', techtourForm('en', opts));

  // Pass 2 (EN): add the "also …" subform blocks now that both ids are known.
  app = (await req('PATCH', `/api/forms/${app.id}?locale=en`, applicationForm('en', { ...opts, techtourFormId: tt.id }))).doc;
  tt = (await req('PATCH', `/api/forms/${tt.id}?locale=en`, techtourForm('en', { ...opts, applicationFormId: app.id }))).doc;

  // DE: block rows are matched by id, so reuse the ids from the EN documents
  // (by position — the definitions produce the same field order per locale).
  const localise = async (doc, def) => {
    const fields = def.fields.map((f, i) => {
      const row = doc.fields?.[i];
      const out = { ...f, id: row?.id };
      if (f.blockType === 'checkboxGroup' && row?.options) {
        out.options = f.options.map((o, j) => ({ ...o, id: row.options[j]?.id }));
      }
      return out;
    });
    await req('PATCH', `/api/forms/${doc.id}?locale=de`, {
      title: def.title,
      submitButtonLabel: def.submitButtonLabel,
      confirmationMessage: def.confirmationMessage,
      fields,
    });
  };
  await localise(app, applicationForm('de', { techtourFormId: tt.id }));
  await localise(tt, techtourForm('de', { applicationFormId: app.id }));
  log(`forms upserted: application id ${app.id}, techtour id ${tt.id} (en + de)`);

  // TechTour page: only seed when nobody has written content yet.
  const page = await req('GET', '/api/globals/tech-tour?locale=en&depth=0');
  if (page?.title) {
    log('tech-tour page already has content — left untouched');
  } else {
    const en = techTourGlobal('en');
    await req('POST', '/api/globals/tech-tour?locale=en', en);
    const saved = await req('GET', '/api/globals/tech-tour?locale=en&depth=0');
    const de = techTourGlobal('de');
    de.events = de.events.map((e, i) => ({ ...e, id: saved.events?.[i]?.id }));
    de.highlights = de.highlights.map((h, i) => ({ ...h, id: saved.highlights?.[i]?.id }));
    await req('POST', '/api/globals/tech-tour?locale=de', de);
    log('tech-tour page seeded with starting content (en + de)');
  }
  await attachTechTourLogos({ base, cookie, log });
  return { application: app, techtour: tt };
}
