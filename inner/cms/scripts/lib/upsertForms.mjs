import { applicationForm, techtourForm, techTourGlobal } from './formDefinitions.mjs';

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
  return { application: app, techtour: tt };
}
