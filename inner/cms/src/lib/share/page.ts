import { escapeHtml as esc } from '../waitlistEmailTemplate';
import type { Evening } from './evening';
import type { HostRow } from './registrations';

/**
 * The page a host company's contact opens from the share link
 * (GET /api/share/:token). One self-contained document: inline CSS and a
 * small script under a per-response nonce, no fonts, images or scripts from
 * anywhere, nothing stored but the sign-in cookie. Works for the three states
 * the link can be in: not valid (any more), not signed in, signed in.
 *
 * English only: the hosts are international teams; the registrations show
 * whatever language each person wrote in.
 */

type Base = { nonce: string; contactEmail: string; siteOrigin: string };

export type PageInput =
  | (Base & { state: 'invalid'; reason: 'missing' | 'expired' | 'blocked' })
  | (Base & { state: 'signin'; token: string; title: string; evening: Evening | null; expiresAt: Date })
  | (Base & {
      state: 'list';
      token: string;
      title: string;
      evening: Evening;
      expiresAt: Date;
      email: string;
      rows: HostRow[];
    });

const fmtDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', weekday: 'short', day: 'numeric', month: 'short' });
const fmtWhen = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const STYLE = `
:root { --paper:#f5f5f3; --card:#fff; --ink:#171717; --muted:#6b6b6b; --line:#e4e4e1; --soft:#f0f0ee;
  --yes:#1a7f37; --yes-tint:#e3f5e8; --no:#b42318; --no-tint:#fdecea; --focus:#2a78d6; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --paper:#0f0f0f; --card:#171717; --ink:#f2f2f2; --muted:#a3a3a3;
  --line:#2c2c2c; --soft:#1f1f1f; --yes:#4ac26b; --yes-tint:#14301d; --no:#f47067; --no-tint:#3a1714; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--paper); color:var(--ink); font:16px/1.55 'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; }
.mono { font-family:'IBM Plex Mono','SF Mono',Menlo,Consolas,monospace; }
a { color:inherit; }
:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.top { display:flex; justify-content:space-between; align-items:center; gap:12px; max-width:920px; margin:0 auto; padding:22px 20px 0; font-size:14px; }
.top .brand { font-weight:600; }
.top .muted { color:var(--muted); }
main { max-width:920px; margin:0 auto; padding:28px 20px 48px; }
.kicker { margin:0 0 6px; font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }
h1 { margin:0; font-size:30px; line-height:1.2; letter-spacing:-.01em; }
.meta { margin:8px 0 0; color:var(--muted); font-size:15px; }
.card { margin-top:24px; background:var(--card); border:1px solid var(--line); border-radius:6px; }
.signin { padding:24px; max-width:460px; }
.signin p { margin:0 0 16px; }
label { display:block; font-size:14px; font-weight:600; margin:0 0 6px; }
input { width:100%; font:inherit; color:inherit; background:var(--card); border:1px solid var(--line); border-radius:4px; padding:10px 12px; }
input.code { font-family:'IBM Plex Mono','SF Mono',Menlo,Consolas,monospace; font-size:22px; letter-spacing:.3em; }
.row { display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; align-items:center; }
button { font:inherit; font-size:15px; cursor:pointer; border-radius:4px; padding:9px 16px; border:1px solid var(--ink); background:var(--ink); color:var(--card); }
button.ghost { background:transparent; color:var(--ink); border-color:var(--line); }
button:disabled { opacity:.5; cursor:default; }
.linkish { border:0; background:none; color:var(--muted); padding:0; text-decoration:underline; font-size:14px; }
.msg { margin:12px 0 0; font-size:14px; color:var(--muted); }
.msg:empty { display:none; }
.msg.err { color:var(--no); }
.list-msg { margin:0; padding:10px 20px; border-bottom:1px solid var(--line); }
.bar { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; padding:16px 20px; border-bottom:1px solid var(--line); }
.counts { display:flex; gap:22px; flex-wrap:wrap; }
.count b { display:block; font-size:24px; line-height:1.1; font-variant-numeric:tabular-nums; }
.count span { font-size:13px; color:var(--muted); }
.tools { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; padding:12px 20px; border-bottom:1px solid var(--line); background:var(--soft); }
.seg { display:inline-flex; border:1px solid var(--line); border-radius:4px; overflow:hidden; background:var(--card); }
.seg button { border:0; border-radius:0; background:transparent; color:var(--muted); padding:6px 12px; font-size:14px; }
.seg button + button { border-left:1px solid var(--line); }
.seg button[aria-pressed="true"] { background:var(--ink); color:var(--card); }
ol.people { list-style:none; margin:0; padding:0; }
.person { display:grid; grid-template-columns:36px minmax(0,1fr) auto; gap:6px 16px; align-items:center; padding:14px 20px; border-bottom:1px solid var(--line); box-shadow:inset 3px 0 0 transparent; }
.person:last-child { border-bottom:0; }
.person[data-decision="admitted"] { box-shadow:inset 3px 0 0 var(--yes); }
.person[data-decision="declined"] { box-shadow:inset 3px 0 0 var(--no); }
.person .n { color:var(--muted); font-size:13px; font-variant-numeric:tabular-nums; }
.person .who strong { display:block; font-size:16px; }
.person .who small { display:block; color:var(--muted); font-size:13px; }
.person .who .details { margin:4px 0 0; font-size:14px; color:var(--ink); }
.person .who .details span { color:var(--muted); }
.act { display:flex; align-items:center; gap:16px; }
.cv { font-size:14px; white-space:nowrap; padding:6px 12px; border:1px solid var(--line); border-radius:4px; text-decoration:none; min-width:64px; text-align:center; }
.cv:hover { background:var(--soft); }
.cv.none { border-style:dashed; color:var(--muted); }
.decide { display:inline-flex; gap:6px; }
.decide button { background:transparent; color:var(--ink); border:1px solid var(--line); padding:6px 12px; font-size:14px; min-width:80px; }
.decide button[data-d="admitted"][aria-pressed="true"] { background:var(--yes-tint); border-color:var(--yes); color:var(--yes); }
.decide button[data-d="declined"][aria-pressed="true"] { background:var(--no-tint); border-color:var(--no); color:var(--no); }
.who-am-i { font-size:14px; color:var(--muted); }
.empty { padding:28px 20px; color:var(--muted); margin:0; }
.notice { margin-top:20px; padding:16px 20px; border:1px solid var(--line); border-radius:6px; background:var(--card); font-size:14px; color:var(--muted); }
.notice strong { color:var(--ink); }
footer { max-width:920px; margin:0 auto; padding:0 20px 40px; font-size:13px; color:var(--muted); }
.hidden { display:none !important; }
@media (max-width:640px) {
  h1 { font-size:24px; }
  .person { grid-template-columns:28px minmax(0,1fr); }
  .person .act { grid-column:2; gap:8px; flex-wrap:wrap; }
}
`;

const SCRIPT = `
(() => {
  const base = document.body.dataset.base;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  async function post(path, body) {
    const res = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body || {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong – please try again.');
    return data;
  }
  const say = (el, text, err) => { if (!el) return; el.textContent = text || ''; el.classList.toggle('err', !!err); };

  // ---- sign in
  const emailForm = $('#email-form'), codeForm = $('#code-form');
  if (emailForm) {
    let email = '';
    emailForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button', emailForm); btn.disabled = true; say($('#email-msg'), 'Sending…');
      email = $('#email').value.trim();
      try {
        await post('/code', { email });
        emailForm.classList.add('hidden'); codeForm.classList.remove('hidden');
        $('#code-to').textContent = email; $('#code').focus();
      } catch (err) { say($('#email-msg'), err.message, true); }
      btn.disabled = false;
    });
    codeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type=submit]', codeForm); btn.disabled = true; say($('#code-msg'), 'Checking…');
      try { await post('/verify', { email, code: $('#code').value }); location.reload(); }
      catch (err) { say($('#code-msg'), err.message, true); btn.disabled = false; }
    });
    $('#other-address').addEventListener('click', () => {
      codeForm.classList.add('hidden'); emailForm.classList.remove('hidden'); say($('#code-msg'), ''); $('#email').focus();
    });
  }

  // ---- the list
  const list = $('ol.people');
  if (!list) return;
  const counts = () => {
    const rows = $$('.person');
    const n = (d) => rows.filter((r) => r.dataset.decision === d).length;
    $('#c-admitted').textContent = n('admitted');
    $('#c-declined').textContent = n('declined');
    const open = n('');
    $('#c-open').textContent = open;
    const bulk = $('#admit-open');
    bulk.disabled = open === 0; bulk.dataset.armed = ''; bulk.textContent = 'Admit everyone still open';
  };
  const show = (filter) => {
    $$('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
    let shown = 0;
    $$('.person').forEach((r) => { const on = filter === 'all' || r.dataset.decision === (filter === 'open' ? '' : filter); r.classList.toggle('hidden', !on); if (on) shown++; });
    $('#none').classList.toggle('hidden', shown > 0);
  };
  let filter = 'all';
  $$('.seg button').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; show(filter); }));
  const apply = (decisions) => {
    Object.entries(decisions).forEach(([id, d]) => {
      const row = $('.person[data-id="' + id + '"]'); if (!row) return;
      row.dataset.decision = d || '';
      $$('.decide button', row).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.d === d)));
    });
    counts(); show(filter);
  };
  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('.decide button'); if (!btn) return;
    const row = btn.closest('.person');
    const next = row.dataset.decision === btn.dataset.d ? null : btn.dataset.d;
    $$('.decide button', row).forEach((b) => (b.disabled = true));
    try { apply((await post('/decision', { submissions: [Number(row.dataset.id)], decision: next })).decisions); say($('#list-msg'), ''); }
    catch (err) { say($('#list-msg'), err.message, true); }
    $$('.decide button', row).forEach((b) => (b.disabled = false));
  });
  const bulk = $('#admit-open');
  bulk.addEventListener('click', async () => {
    const open = $$('.person').filter((r) => r.dataset.decision === '').map((r) => Number(r.dataset.id));
    if (!open.length) return;
    if (!bulk.dataset.armed) { bulk.dataset.armed = '1'; bulk.textContent = 'Admit ' + open.length + (open.length === 1 ? ' person' : ' people') + '? Click again'; setTimeout(() => { if (bulk.dataset.armed) counts(); }, 5000); return; }
    bulk.disabled = true; say($('#list-msg'), 'Saving…');
    try { apply((await post('/decision', { submissions: open, decision: 'admitted' })).decisions); say($('#list-msg'), ''); }
    catch (err) { say($('#list-msg'), err.message, true); counts(); }
  });
  $('#sign-out').addEventListener('click', async () => { await post('/sign-out').catch(() => {}); location.reload(); });
  counts(); show(filter);
})();
`;

const eveningLine = (e: Evening | null) =>
  e
    ? [e.label.split(' · ')[0], e.time, e.location].filter(Boolean).map((x) => esc(String(x))).join(' · ')
    : '';

const frame = (input: PageInput, title: string, body: string, base = '') => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(title)} – Coding for Change</title>
<style nonce="${input.nonce}">${STYLE}</style>
</head>
<body data-base="${esc(base)}">
<div class="top"><span class="brand mono">&gt;_&#9825; Coding for Change</span><span class="muted mono">Munich TechTour</span></div>
<main>${body}</main>
<footer>Coding for Change e.V. · <a href="${esc(input.siteOrigin)}/privacy">Privacy policy</a> · <a href="mailto:${esc(input.contactEmail)}">${esc(input.contactEmail)}</a></footer>
<script nonce="${input.nonce}">${SCRIPT}</script>
</body>
</html>`;

export function sharePage(input: PageInput): string {
  if (input.state === 'invalid') {
    const why =
      input.reason === 'expired'
        ? 'This link has expired.'
        : input.reason === 'blocked'
          ? 'This link has been switched off.'
          : 'This link does not work.';
    return frame(
      input,
      'Link not available',
      `<p class="kicker mono">Registrations for your evening</p>
<h1>${esc(why)}</h1>
<p class="meta">If you still need the registrations, write to <a href="mailto:${esc(input.contactEmail)}">${esc(input.contactEmail)}</a> and we will send you a new link.</p>`,
    );
  }

  const base = `/api/share/${encodeURIComponent(input.token)}`;
  const head = `<p class="kicker mono">Registrations for your evening</p>
<h1>${esc(input.title)}</h1>
<p class="meta">${eveningLine(input.evening)}${input.evening ? ' · ' : ''}link valid until ${esc(fmtWhen.format(input.expiresAt))}</p>`;

  if (input.state === 'signin') {
    return frame(
      input,
      input.title,
      `${head}
<section class="card signin" aria-label="Sign in">
  <form id="email-form" novalidate>
    <p>Enter the email address Coding for Change has on file for you – we will send you a six-digit code.</p>
    <label for="email">Your email address</label>
    <input id="email" name="email" type="email" autocomplete="email" required />
    <div class="row"><button type="submit">Send me a code</button></div>
    <p class="msg" id="email-msg" role="status"></p>
  </form>
  <form id="code-form" class="hidden" novalidate>
    <p>We sent a code to <strong id="code-to"></strong>. It works for 10 minutes.</p>
    <label for="code">Code</label>
    <input id="code" class="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required />
    <div class="row"><button type="submit">Sign in</button><button type="button" class="linkish" id="other-address">Use another address</button></div>
    <p class="msg" id="code-msg" role="status"></p>
  </form>
</section>`,
      base,
    );
  }

  const rows = input.rows
    .map(
      (r, i) => `<li class="person" data-id="${r.id}" data-decision="${r.decision ?? ''}">
  <span class="n">${i + 1}</span>
  <div class="who">
    <strong>${esc(r.name)}</strong>
    <small>registered ${esc(fmtDay.format(new Date(r.registeredAt)))}</small>
    ${r.details.length ? `<p class="details">${r.details.map((d) => `<span>${esc(d.label)}:</span> ${esc(d.value)}`).join(' · ')}</p>` : ''}
  </div>
  <div class="act">
    ${r.hasCv ? `<a class="cv" href="${base}/cv/${r.id}" target="_blank" rel="noopener">CV ↗</a>` : '<span class="cv none">No CV</span>'}
    <div class="decide" role="group" aria-label="Decision for ${esc(r.name)}">
      <button type="button" data-d="admitted" aria-pressed="${r.decision === 'admitted'}">Admit</button>
      <button type="button" data-d="declined" aria-pressed="${r.decision === 'declined'}">Decline</button>
    </div>
  </div>
</li>`,
    )
    .join('\n');

  return frame(
    input,
    input.title,
    `${head}
<section class="card" aria-label="Registrations">
  <div class="bar">
    <div class="counts">
      <div class="count"><b>${input.rows.length}</b><span>registered</span></div>
      <div class="count"><b id="c-admitted">0</b><span>admitted</span></div>
      <div class="count"><b id="c-declined">0</b><span>declined</span></div>
      <div class="count"><b id="c-open">0</b><span>still open</span></div>
    </div>
    <button type="button" id="admit-open">Admit everyone still open</button>
  </div>
  <div class="tools">
    <div class="seg" role="group" aria-label="Show">
      <button type="button" data-filter="all" aria-pressed="true">All</button>
      <button type="button" data-filter="open" aria-pressed="false">Open</button>
      <button type="button" data-filter="admitted" aria-pressed="false">Admitted</button>
      <button type="button" data-filter="declined" aria-pressed="false">Declined</button>
    </div>
    <span class="who-am-i">Signed in as ${esc(input.email)} · <button type="button" class="linkish" id="sign-out">Sign out</button></span>
  </div>
  <p class="msg list-msg" id="list-msg" role="status"></p>
  <ol class="people">${rows}</ol>
  <p class="empty${input.rows.length ? ' hidden' : ''}" id="none">${input.rows.length ? 'Nobody in this view.' : 'Nobody has registered for this evening yet.'}</p>
</section>
<aside class="notice"><strong>Please use these registrations only to decide who joins your evening and to prepare it</strong> (for example access to your building), and delete any CVs you downloaded once the evening is over. Your decisions reach us right away – we let everyone know. Questions: <a href="mailto:${esc(input.contactEmail)}">${esc(input.contactEmail)}</a></aside>`,
    base,
  );
}
