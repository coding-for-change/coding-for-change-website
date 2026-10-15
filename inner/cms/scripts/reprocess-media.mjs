#!/usr/bin/env node
/**
 * Run the images already in the Media collection through the upload pipeline
 * (collections/Media.ts): the 2400px cap, WebP conversion and the thumbnail /
 * card / large renditions. New uploads get this on the way in; this is for
 * the library as it was before the pipeline existed — run it once after
 * deploying that change.
 *
 *   CMS_URL=https://codingforchange.com CMS_EMAIL=… CMS_PASSWORD=… \
 *     node scripts/reprocess-media.mjs            # dry run: lists what would be reprocessed
 *     node scripts/reprocess-media.mjs --apply    # does it
 *     node scripts/reprocess-media.mjs --apply --force   # also images that already have renditions
 *
 * Each file is downloaded from the CMS and sent straight back as the same
 * document's new file (PATCH /api/media/:id), so ids — and every relationship
 * pointing at them — stay as they are. Only what Payload resizes is touched
 * (JPEG, PNG, GIF, WebP, TIFF, AVIF); SVGs, videos and HEIC files are listed
 * and skipped. A failure on one file is reported and the run carries on.
 */
const BASE = (process.env.CMS_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.CMS_EMAIL;
const PASSWORD = process.env.CMS_PASSWORD;
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FORCE = args.includes('--force');
const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff', 'image/avif']);

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
const auth = { Authorization: `JWT ${(await login.json()).token}` };

// Every media document, oldest first.
const docs = [];
for (let page = 1; ; page++) {
  const res = await fetch(`${BASE}/api/media?limit=100&page=${page}&depth=0&sort=id`, { headers: auth });
  if (!res.ok) {
    console.error(`Listing media failed: ${res.status}`);
    process.exit(1);
  }
  const body = await res.json();
  docs.push(...body.docs);
  if (!body.hasNextPage) break;
}

const mb = (n) => `${((n || 0) / 1e6).toFixed(2)} MB`;
const todo = [];
let skipped = 0;
for (const doc of docs) {
  if (!RESIZABLE.has(doc.mimeType)) {
    skipped++;
    continue;
  }
  const done = Boolean(doc.sizes?.thumbnail?.url || doc.sizes?.card?.url || doc.sizes?.large?.url);
  if (done && !FORCE) {
    skipped++;
    continue;
  }
  todo.push(doc);
}
console.log(
  `${docs.length} media documents on ${BASE}: ${todo.length} to reprocess, ${skipped} skipped (SVG/video/other, or already done)${APPLY ? '' : ' — DRY RUN'}`
);

let before = 0;
let after = 0;
let failed = 0;
for (const doc of todo) {
  const line = `#${doc.id} ${doc.filename} (${doc.mimeType}, ${mb(doc.filesize)}${doc.width ? `, ${doc.width}×${doc.height}` : ''})`;
  if (!APPLY) {
    console.log(`  would reprocess ${line}`);
    continue;
  }
  try {
    const file = await fetch(`${BASE}/api/media/file/${encodeURIComponent(doc.filename)}`);
    if (!file.ok) throw new Error(`download ${file.status}`);
    const bytes = await file.arrayBuffer();
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: doc.mimeType }), doc.filename);
    form.append('_payload', JSON.stringify({ alt: doc.alt || doc.filename }));
    const res = await fetch(`${BASE}/api/media/${doc.id}`, { method: 'PATCH', headers: auth, body: form });
    const body = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body).slice(0, 300)}`);
    const next = body.doc;
    before += doc.filesize || 0;
    after += next.filesize || 0;
    console.log(
      `  ✓ ${line} → ${next.filename} (${next.mimeType}, ${mb(next.filesize)}; renditions: ${['thumbnail', 'card', 'large'].filter((s) => next.sizes?.[s]?.url).join(', ') || 'none'})`
    );
  } catch (err) {
    failed++;
    console.error(`  ✗ ${line}: ${err.message}`);
  }
}
if (APPLY) {
  console.log(`done: originals ${mb(before)} → ${mb(after)}${failed ? `, ${failed} failed` : ''}`);
  process.exit(failed ? 1 : 0);
}
