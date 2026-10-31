import { escapeHtml as esc } from '../waitlistEmailTemplate';
import type { Evening } from './evening';
import { LOGO_SVG, MARK_SVG } from './logo';
import type { HostRow } from './registrations';

/**
 * The page a host company's contact opens from the share link
 * (GET /api/share/:token). One self-contained document: inline CSS and a
 * small script under a per-response nonce, no fonts, images or scripts from
 * anywhere, nothing stored but the sign-in cookie. Works for the three states
 * the link can be in: not valid (any more), not signed in, signed in.
 *
 * Signed in, wide screens get the list on the left and the picked person's CV
 * on the right, in a frame of the link's own CV route that takes the window's
 * full height – and if the window is tall enough, the page itself stands
 * still and only the list and the CV scroll. Narrow screens keep one column
 * and open a CV in a new tab. "Download CVs" fetches the CVs of whoever the
 * list shows as one ZIP.
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

/** Beside the name of someone we marked as a member (lib/members.ts). */
const MEMBER_BADGE = `<span class="member" title="Member of Coding for Change">${MARK_SVG}Member</span>`;

const STYLE = `
:root { --paper:#f5f5f3; --card:#fff; --ink:#171717; --muted:#6b6b6b; --line:#e4e4e1; --soft:#f0f0ee; --sel:#e6e6e2;
  --yes:#1a7f37; --yes-tint:#e3f5e8; --no:#b42318; --no-tint:#fdecea; --focus:#2a78d6; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --paper:#0f0f0f; --card:#171717; --ink:#f2f2f2; --muted:#a3a3a3;
  --line:#2c2c2c; --soft:#1f1f1f; --sel:#292929; --yes:#4ac26b; --yes-tint:#14301d; --no:#f47067; --no-tint:#3a1714; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--paper); color:var(--ink); font:16px/1.55 'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; }
.mono { font-family:'IBM Plex Mono','SF Mono',Menlo,Consolas,monospace; }
a { color:inherit; }
:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
.top { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; max-width:920px; margin:0 auto; padding:22px 20px 0; font-size:14px; }
.top .logo { display:block; height:20px; width:auto; }
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
.pick { display:block; border:0; border-radius:0; background:none; color:var(--ink); padding:0; font-size:16px; font-weight:600; text-align:left; }
.name { display:flex; align-items:center; flex-wrap:wrap; gap:2px 8px; }
.member { display:inline-flex; align-items:center; gap:5px; padding:0 7px; border:1px solid var(--line); border-radius:999px; background:var(--soft); color:var(--ink); font-size:12px; font-weight:500; line-height:20px; white-space:nowrap; }
.member .mark { display:block; height:8px; width:auto; }
.who small, .v-who small { display:block; color:var(--muted); font-size:13px; }
.details { margin:4px 0 0; font-size:14px; color:var(--ink); }
.details span { color:var(--muted); }
.act { display:flex; align-items:center; gap:16px; }
.cv { font-size:14px; white-space:nowrap; padding:6px 12px; border:1px solid var(--line); border-radius:4px; text-decoration:none; min-width:64px; text-align:center; }
.cv:hover { background:var(--soft); }
.cv.none { border-style:dashed; color:var(--muted); }
.decide { display:inline-flex; gap:6px; }
.decide button { background:var(--card); color:var(--ink); border:1px solid var(--line); padding:6px 12px; font-size:14px; min-width:80px; }
.decide button[data-d="admitted"][aria-pressed="true"] { background:var(--yes-tint); border-color:var(--yes); color:var(--yes); }
.decide button[data-d="declined"][aria-pressed="true"] { background:var(--no-tint); border-color:var(--no); color:var(--no); }
.view { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.who-am-i { font-size:14px; color:var(--muted); }
.empty { padding:28px 20px; color:var(--muted); margin:0; }
.notice { margin:0; padding:16px 20px; border-top:1px solid var(--line); font-size:13px; color:var(--muted); }
.notice strong { color:var(--ink); }
footer { max-width:920px; margin:0 auto; padding:0 20px 40px; font-size:13px; color:var(--muted); }
.viewer { display:none; }
/* One line of name, one of details, the buttons beside them – every pixel
   the head doesn't take goes to the CV. */
.v-head { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:12px 20px; border-bottom:1px solid var(--line); }
.v-who { flex:1; min-width:0; }
.v-who strong { display:block; font-size:18px; line-height:1.3; }
.v-who strong, #v-meta { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
#v-meta small, #v-meta .details { display:inline; margin:0; font-size:13px; }
#v-meta .details::before { content:' · '; color:var(--muted); }
#v-meta .member { margin-right:8px; vertical-align:1px; }
.v-act { display:flex; align-items:center; gap:16px; flex:none; }
.v-body { position:relative; flex:1; min-height:0; overflow:hidden; }
.v-body iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
.v-empty { margin:0; padding:28px 20px; color:var(--muted); }
.nocv { display:none; }
.hidden { display:none !important; }
/* Wide: the CV is a column of its own along the window's right edge, the
   window's full height, next to everything else. */
@media (min-width:960px) {
  body.wide { display:grid; grid-template-columns:minmax(0,1fr) min(56vw,900px); }
  .wide .top, .wide main, .wide footer { max-width:none; margin:0; }
  .viewer { display:flex; flex-direction:column; position:sticky; top:0; align-self:start; height:100vh; background:var(--card); border-left:1px solid var(--line); }
  .wide .person { cursor:pointer; }
  .wide .person:hover { background:var(--soft); }
  .wide .person[data-selected] { background:var(--sel); }
  .wide .person .cv { display:none; }
  .wide .nocv { display:inline; }
  .list .decide button { min-width:0; padding:5px 10px; }
}
/* Wide and tall enough: the page itself stands still, so the header and the
   counts stay in view – only the list and the CV scroll, each on its own. */
@media (min-width:960px) and (min-height:640px) {
  .wide .page { display:flex; flex-direction:column; height:100vh; overflow:hidden; }
  .wide main { flex:1; min-height:0; display:flex; flex-direction:column; padding-bottom:0; }
  .wide .card { flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden; }
  .wide .list { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; }
  .wide footer { padding:12px 20px 14px; }
}
@media (max-width:640px) {
  .top .logo { height:16px; }
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
    let shown = 0, cvs = 0;
    $$('.person').forEach((r) => { const on = filter === 'all' || r.dataset.decision === (filter === 'open' ? '' : filter); r.classList.toggle('hidden', !on); if (on) { shown++; if ($('a.cv', r)) cvs++; } });
    $('#none').classList.toggle('hidden', shown > 0);
    // "Download CVs" fetches whoever the list shows.
    const dl = $('#cv-all');
    dl.classList.toggle('none', !cvs);
    dl.textContent = cvs ? 'Download ' + cvs + (cvs === 1 ? ' CV' : ' CVs') + ' ↓' : 'No CVs to download';
    if (cvs) dl.href = base + '/cvs?show=' + filter; else dl.removeAttribute('href');
  };
  let filter = 'all';
  $$('.seg button').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; show(filter); }));

  // ---- the picked person's CV next to the list (wide screens only – narrow
  // ones open it in a new tab through the row's CV link)
  const viewer = $('#viewer');
  const wide = matchMedia('(min-width: 960px)');
  const side = () => !!viewer && wide.matches;
  const cvLink = (row) => { const a = $('a.cv', row); return a ? a.href : ''; };
  let current = null, shown = null;
  const sync = () => {
    if (current) $$('#v-decide button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.d === current.dataset.decision)));
  };
  const load = () => {
    if (!current || !side() || shown === current) return;
    shown = current;
    const box = $('#v-body'), href = cvLink(current);
    const note = document.createElement('p'); note.className = 'v-empty';
    note.textContent = href ? 'Loading the CV…' : 'No CV came with this registration.';
    box.replaceChildren(note);
    if (!href) return;
    // A new frame each time, so the CVs don't pile up in the back button's history.
    const frame = document.createElement('iframe');
    frame.title = 'CV of ' + $('.pick', current).textContent;
    // Chrome: no page thumbnails, fit to the frame's width (other viewers ignore it).
    frame.src = href + '#navpanes=0&view=FitH';
    frame.addEventListener('load', () => {
      // The route answers JSON when it cannot serve the CV – say so instead of showing that.
      try { if (frame.contentDocument && frame.contentDocument.contentType === 'application/json') { frame.remove(); note.textContent = 'The CV could not be opened.'; } } catch (err) {}
    });
    box.append(frame);
  };
  const select = (row) => {
    if (!side()) { const href = cvLink(row); if (href) window.open(href, '_blank', 'noopener'); return; }
    if (row === current) return;
    if (current) { delete current.dataset.selected; $('.pick', current).removeAttribute('aria-current'); }
    current = row; row.dataset.selected = 'true';
    const pick = $('.pick', row); pick.setAttribute('aria-current', 'true');
    $('#v-name').textContent = $('#v-name').title = pick.textContent;
    const meta = $$('.member, small, .details', $('.who', row));
    $('#v-meta').replaceChildren(...meta.map((el) => el.cloneNode(true)));
    $('#v-meta').title = meta.map((el) => el.textContent.trim()).join(' · ');
    $('#v-decide').setAttribute('aria-label', 'Decision for ' + pick.textContent);
    const href = cvLink(row), open = $('#v-open');
    open.classList.toggle('hidden', !href); if (href) open.href = href;
    $('#v-head').classList.remove('hidden');
    sync(); load();
  };
  wide.addEventListener('change', () => { if (side()) current ? load() : $('.person') && select($('.person')); });

  const apply = (decisions) => {
    Object.entries(decisions).forEach(([id, d]) => {
      const row = $('.person[data-id="' + id + '"]'); if (!row) return;
      row.dataset.decision = d || '';
      $$('.decide button', row).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.d === d)));
    });
    counts(); show(filter); sync();
  };
  const decideOn = async (row, d) => {
    const next = row.dataset.decision === d ? null : d;
    const buttons = $$('.decide button', row).concat(row === current ? $$('#v-decide button') : []);
    buttons.forEach((b) => (b.disabled = true));
    try { apply((await post('/decision', { submissions: [Number(row.dataset.id)], decision: next })).decisions); say($('#list-msg'), ''); }
    catch (err) { say($('#list-msg'), err.message, true); }
    buttons.forEach((b) => (b.disabled = false));
  };
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.person'); if (!row) return;
    const btn = e.target.closest('.decide button');
    if (btn) decideOn(row, btn.dataset.d);
    else if (e.target.closest('.pick') || (side() && !e.target.closest('a'))) select(row);
  });
  list.addEventListener('keydown', (e) => {
    if ((e.key !== 'ArrowDown' && e.key !== 'ArrowUp') || !e.target.classList.contains('pick')) return;
    const rows = $$('.person').filter((r) => !r.classList.contains('hidden'));
    const to = rows[rows.indexOf(e.target.closest('.person')) + (e.key === 'ArrowDown' ? 1 : -1)];
    if (!to) return;
    e.preventDefault(); $('.pick', to).focus();
    if (side()) select(to);
  });
  if (viewer) $('#v-decide').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && current) decideOn(current, b.dataset.d); });
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
  if (side() && $('.person')) select($('.person'));
})();
`;

const eveningLine = (e: Evening | null) =>
  e
    ? [e.label.split(' · ')[0], e.time, e.location].filter(Boolean).map((x) => esc(String(x))).join(' · ')
    : '';

const VIEWER = `<section class="viewer" id="viewer" aria-label="CV">
    <div class="v-head hidden" id="v-head">
      <div class="v-who"><strong id="v-name"></strong><div id="v-meta"></div></div>
      <div class="v-act">
        <a class="cv" id="v-open" target="_blank" rel="noopener" title="Open the CV in a new tab">New tab ↗</a>
        <div class="decide" id="v-decide" role="group" aria-label="Decision">
          <button type="button" data-d="admitted" aria-pressed="false">Admit</button>
          <button type="button" data-d="declined" aria-pressed="false">Decline</button>
        </div>
      </div>
    </div>
    <div class="v-body" id="v-body"><p class="v-empty">Pick someone on the left to see their CV.</p></div>
  </section>`;

const frame = (input: PageInput, title: string, body: string, base = '', viewer = '') => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(title)} – Coding for Change</title>
<style nonce="${input.nonce}">${STYLE}</style>
</head>
<body data-base="${esc(base)}"${viewer ? ' class="wide"' : ''}>
<div class="page">
<div class="top">${LOGO_SVG}<span class="muted mono">Munich Tech Tour</span></div>
<main>${body}</main>
<footer>Coding for Change e.V. · <a href="${esc(input.siteOrigin)}/privacy">Privacy policy</a> · <a href="mailto:${esc(input.contactEmail)}">${esc(input.contactEmail)}</a></footer>
</div>
${viewer}
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
    <div class="name"><button type="button" class="pick" aria-controls="viewer">${esc(r.name)}</button>${r.member ? MEMBER_BADGE : ''}</div>
    <small>registered ${esc(fmtDay.format(new Date(r.registeredAt)))}${r.hasCv ? '' : '<span class="nocv"> · no CV</span>'}</small>
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
  // The notice ends the list, so it scrolls with it when the header stands still.
  const list = `<ol class="people">${rows}</ol>
  <p class="empty${input.rows.length ? ' hidden' : ''}" id="none">${input.rows.length ? 'Nobody in this view.' : 'Nobody has registered for this evening yet.'}</p>
  <aside class="notice"><strong>Please use these registrations only to decide who joins your evening and to prepare it</strong> (for example access to your building), and delete any CVs you downloaded once the evening is over. Your decisions reach us right away – we let everyone know. Questions: <a href="mailto:${esc(input.contactEmail)}">${esc(input.contactEmail)}</a></aside>`;

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
    <div class="view">
      <div class="seg" role="group" aria-label="Show">
        <button type="button" data-filter="all" aria-pressed="true">All</button>
        <button type="button" data-filter="open" aria-pressed="false">Open</button>
        <button type="button" data-filter="admitted" aria-pressed="false">Admitted</button>
        <button type="button" data-filter="declined" aria-pressed="false">Declined</button>
      </div>
      <a class="cv none" id="cv-all" title="One ZIP file with the CVs of everyone shown">No CVs to download</a>
    </div>
    <span class="who-am-i">Signed in as ${esc(input.email)} · <button type="button" class="linkish" id="sign-out">Sign out</button></span>
  </div>
  <p class="msg list-msg" id="list-msg" role="status"></p>
  <div class="list">${list}</div>
</section>`,
    base,
    input.rows.length ? VIEWER : '',
  );
}
