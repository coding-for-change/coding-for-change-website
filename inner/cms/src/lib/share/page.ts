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
 * Two extras, each switched on per link in the admin (collections/ShareLinks.ts)
 * – without them the page is the plain admit-or-decline list the hosts know:
 * - "Waitlist": a third choice beside admit and decline, and a view of the
 *   waitlist in the order people move up, with ↑/↓ to change it.
 * - "1–10 rating": each person gets a rating, the list can be sorted by it,
 *   and the waitlist goes by it first.
 * With either on, keys help through a long list (shown under the CV): ↑/↓
 * next person, A / W / D decide, 1–9 and 0 (= 10) rate.
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
      /** The link shows the 1–10 rating. */
      rating: boolean;
      /** The link has a waitlist. */
      waitlist: boolean;
      /** Someone on the waitlist moves up on their own when a spot frees up. */
      movingUp: boolean;
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
  --yes:#1a7f37; --yes-tint:#e3f5e8; --no:#b42318; --no-tint:#fdecea; --wait:#8a5a00; --wait-tint:#fdf1d8; --focus:#2a78d6; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --paper:#0f0f0f; --card:#171717; --ink:#f2f2f2; --muted:#a3a3a3;
  --line:#2c2c2c; --soft:#1f1f1f; --sel:#292929; --yes:#4ac26b; --yes-tint:#14301d; --no:#f47067; --no-tint:#3a1714;
  --wait:#e3b341; --wait-tint:#382a0c; } }
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
.waiting .counts { gap:16px; }
.count b { display:block; font-size:24px; line-height:1.1; font-variant-numeric:tabular-nums; }
.count span { font-size:13px; color:var(--muted); }
.tools { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; padding:12px 20px; border-bottom:1px solid var(--line); background:var(--soft); }
.waiting #admit-open { font-size:14px; padding:8px 14px; }
.sort-label { font-size:14px; color:var(--muted); }
.seg { display:inline-flex; max-width:100%; overflow-x:auto; border:1px solid var(--line); border-radius:4px; background:var(--card); }
.seg button { flex:none; }
.seg button { border:0; border-radius:0; background:transparent; color:var(--muted); padding:6px 12px; font-size:14px; }
.seg button + button { border-left:1px solid var(--line); }
.seg button[aria-pressed="true"] { background:var(--ink); color:var(--card); }
ol.people { list-style:none; margin:0; padding:0; }
.person { display:grid; grid-template-columns:36px minmax(0,1fr) auto; gap:6px 16px; align-items:center; padding:14px 20px; border-bottom:1px solid var(--line); box-shadow:inset 3px 0 0 transparent; }
.person:last-child { border-bottom:0; }
.person[data-decision="admitted"] { box-shadow:inset 3px 0 0 var(--yes); }
.person[data-decision="declined"] { box-shadow:inset 3px 0 0 var(--no); }
.person[data-decision="waitlisted"] { box-shadow:inset 3px 0 0 var(--wait); }
.person .n { color:var(--muted); font-size:13px; font-variant-numeric:tabular-nums; }
.pick { display:block; border:0; border-radius:0; background:none; color:var(--ink); padding:0; font-size:16px; font-weight:600; text-align:left; }
.name { display:flex; align-items:center; flex-wrap:wrap; gap:2px 8px; }
.member { display:inline-flex; align-items:center; gap:5px; padding:0 7px; border:1px solid var(--line); border-radius:999px; background:var(--soft); color:var(--ink); font-size:12px; font-weight:500; line-height:20px; white-space:nowrap; }
.member .mark { display:block; height:8px; width:auto; }
.tag { display:inline-flex; align-items:center; padding:0 7px; border:1px solid var(--line); border-radius:999px; font-size:12px; font-weight:500; line-height:20px; white-space:nowrap; }
.tag.wl { background:var(--wait-tint); border-color:var(--wait); color:var(--wait); }
.tag.up { background:var(--yes-tint); border-color:var(--yes); color:var(--yes); }
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
.decide button[data-d="waitlisted"][aria-pressed="true"] { background:var(--wait-tint); border-color:var(--wait); color:var(--wait); }
select.score { font:inherit; font-size:14px; color:var(--muted); background:var(--card); border:1px solid var(--line); border-radius:4px; padding:5px 4px; font-variant-numeric:tabular-nums; cursor:pointer; }
select.score.set { color:var(--ink); border-color:var(--ink); font-weight:600; }
.order { display:none; gap:4px; }
.view-waitlisted .person[data-decision="waitlisted"] .order { display:inline-flex; }
.order button { background:var(--card); color:var(--ink); border:1px solid var(--line); padding:5px 9px; font-size:14px; line-height:1.2; }
.v-keys { flex:none; margin:0; padding:7px 20px; border-top:1px solid var(--line); font-size:13px; color:var(--muted); }
kbd { font-family:'IBM Plex Mono','SF Mono',Menlo,Consolas,monospace; font-size:12px; padding:0 4px; border:1px solid var(--line); border-radius:3px; background:var(--card); color:var(--ink); }
.view { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.who-am-i { font-size:14px; color:var(--muted); }
.empty { padding:28px 20px; color:var(--muted); margin:0; }
.notice { margin:0; padding:16px 20px; border-top:1px solid var(--line); font-size:13px; color:var(--muted); }
.notice strong { color:var(--ink); }
.notice p { margin:0; }
.notice p + p { margin-top:8px; }
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
#v-meta .member, #v-meta .tag { margin-right:8px; vertical-align:1px; }
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
/* With a rating or the waitlist's arrows a row has more buttons: when the
   list's column gets narrow (the CV beside it), they go under the name
   instead of squeezing it. */
.list { container-type:inline-size; }
@container (max-width:560px) {
  .rated .person { grid-template-columns:28px minmax(0,1fr); }
  .rated .person .act { grid-column:2; gap:8px; flex-wrap:wrap; }
}
@container (max-width:660px) {
  .view-waitlisted .person { grid-template-columns:28px minmax(0,1fr); }
  .view-waitlisted .person .act { grid-column:2; gap:8px; flex-wrap:wrap; }
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
  .waiting .tools { padding:12px 14px; }
  .waiting .seg button { padding:6px 8px; font-size:13px; }
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
  // The link's extras (see the top of lib/share/page.ts): without either, the
  // page behaves as it always did – no extra keys, no jumping ahead.
  const rated = document.body.classList.contains('rated');
  const waiting = document.body.classList.contains('waiting');
  const keyed = rated || waiting;
  const rows = () => $$('.person');
  const bulk = $('#admit-open');
  const counts = () => {
    const all = rows();
    const n = (d) => all.filter((r) => r.dataset.decision === d).length;
    $('#c-admitted').textContent = n('admitted');
    if (waiting) $('#c-waitlisted').textContent = n('waitlisted');
    $('#c-declined').textContent = n('declined');
    const open = n('');
    $('#c-open').textContent = open;
    bulk.disabled = open === 0; bulk.dataset.armed = ''; bulk.textContent = 'Admit everyone still open';
  };

  // ---- what the list shows, and in which order: as registered, by rating,
  // or – the waitlist on its own – in the order people move up.
  let filter = 'all', sort = 'registered';
  const num = (r, key) => Number(r.dataset[key] || 0);
  const byNumber = (a, b) => num(a, 'n') - num(b, 'n');
  const order = () => {
    if (filter === 'waitlisted') return (a, b) => (num(a, 'waitlist') || 1e9) - (num(b, 'waitlist') || 1e9) || byNumber(a, b);
    if (sort === 'rating') return (a, b) => num(b, 'score') - num(a, 'score') || byNumber(a, b);
    return byNumber;
  };
  const arrange = () => {
    const now = rows(), sorted = [...now].sort(order());
    if (sorted.every((r, i) => r === now[i])) return;
    // Moving a row out of the DOM and back takes its focus away – give it back.
    const focused = document.activeElement;
    list.append(...sorted);
    if (focused && focused !== document.activeElement && list.contains(focused)) focused.focus({ preventScroll: true });
  };
  const visible = () => rows().filter((r) => !r.classList.contains('hidden'));
  // ↑/↓ on the waitlist: one place, and only past someone with the same rating.
  const orderButtons = () => {
    const wl = rows().filter((r) => r.dataset.decision === 'waitlisted').sort((a, b) => num(a, 'waitlist') - num(b, 'waitlist'));
    wl.forEach((r, i) => {
      const up = $('.order [data-dir="up"]', r), down = $('.order [data-dir="down"]', r);
      if (!up || !down) return;
      const same = (o) => !!o && (!rated || num(o, 'score') === num(r, 'score'));
      up.disabled = !same(wl[i - 1]);
      down.disabled = !same(wl[i + 1]);
    });
  };
  // Re-sorted only when asked (a filter or sort button, a move on the
  // waitlist) – not after each rating, or the row would jump away mid-work.
  const show = (rearrange) => {
    document.body.classList.toggle('view-waitlisted', filter === 'waitlisted');
    $$('#filter button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
    $$('#sort button').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.sort === sort)); b.disabled = filter === 'waitlisted'; });
    if (rearrange) arrange();
    let shown = 0, cvs = 0;
    rows().forEach((r) => { const on = filter === 'all' || r.dataset.decision === (filter === 'open' ? '' : filter); r.classList.toggle('hidden', !on); if (on) { shown++; if ($('a.cv', r)) cvs++; } });
    $('#none').classList.toggle('hidden', shown > 0);
    orderButtons();
    // "Download CVs" fetches whoever the list shows.
    const dl = $('#cv-all');
    dl.classList.toggle('none', !cvs);
    dl.textContent = cvs ? 'Download ' + cvs + (cvs === 1 ? ' CV' : ' CVs') + ' ↓' : 'No CVs to download';
    if (cvs) dl.href = base + '/cvs?show=' + filter; else dl.removeAttribute('href');
  };
  // The CV beside the list follows the view: someone it no longer shows makes way for its first.
  const keepInView = () => { if (keyed && side() && (!current || current.classList.contains('hidden')) && visible()[0]) select(visible()[0]); };
  $$('#filter button').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; show(true); keepInView(); }));
  $$('#sort button').forEach((b) => b.addEventListener('click', () => { sort = b.dataset.sort; show(true); }));

  // ---- the picked person's CV next to the list (wide screens only – narrow
  // ones open it in a new tab through the row's CV link)
  const viewer = $('#viewer');
  const wide = matchMedia('(min-width: 960px)');
  const side = () => !!viewer && wide.matches;
  const cvLink = (row) => { const a = $('a.cv', row); return a ? a.href : ''; };
  let current = null, shown = null;
  const sync = () => {
    if (!current || !viewer) return;
    $$('#v-decide button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.d === current.dataset.decision)));
    const vs = $('#v-score');
    if (vs) { vs.value = current.dataset.score || ''; vs.classList.toggle('set', !!current.dataset.score); }
    const meta = $$('.member, .tag:not(.hidden), small, .details', $('.who', current));
    $('#v-meta').replaceChildren(...meta.map((el) => el.cloneNode(true)));
    $('#v-meta').title = meta.map((el) => el.textContent.trim()).join(' · ');
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
    $('#v-decide').setAttribute('aria-label', 'Decision for ' + pick.textContent);
    const vs = $('#v-score'); if (vs) vs.setAttribute('aria-label', 'Rating for ' + pick.textContent);
    const href = cvLink(row), open = $('#v-open');
    open.classList.toggle('hidden', !href); if (href) open.href = href;
    $('#v-head').classList.remove('hidden');
    sync(); load();
  };
  wide.addEventListener('change', () => { if (side()) current ? load() : visible()[0] && select(visible()[0]); });

  // ---- changes: the server answers with every row as it is now
  const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Berlin' });
  const apply = (state) => {
    (state.rows || []).forEach((s) => {
      const row = $('.person[data-id="' + s.id + '"]'); if (!row) return;
      row.dataset.decision = s.decision || '';
      row.dataset.score = s.score == null ? '' : String(s.score);
      row.dataset.waitlist = s.waitlist == null ? '' : String(s.waitlist);
      $$('.decide button', row).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.d === s.decision)));
      const sel = $('select.score', row);
      if (sel) { sel.value = row.dataset.score; sel.classList.toggle('set', !!row.dataset.score); }
      const tag = $('.tag', row);
      if (tag) {
        tag.className = 'tag' + (s.waitlist ? ' wl' : s.movedUpAt ? ' up' : ' hidden');
        tag.textContent = s.waitlist ? 'Waitlist #' + s.waitlist : s.movedUpAt ? 'From the waitlist' : '';
        tag.title = s.waitlist ? 'Place on the waitlist – #1 moves up first' : s.movedUpAt ? 'Moved up from the waitlist on ' + fmtDay(s.movedUpAt) + ' – we told them' : '';
      }
    });
    const before = visible(), at = before.indexOf(current);
    counts(); show(filter === 'waitlisted'); sync();
    // Decided someone the view no longer shows (e.g. under "Open"): on to the
    // one after them, so a long list goes by with one key per person.
    if (keyed && side() && current && current.classList.contains('hidden')) {
      const rs = visible(), next = rs.find((r) => before.indexOf(r) > at) || rs[rs.length - 1];
      if (next) { select(next); $('.pick', next).focus({ preventScroll: false }); }
    }
  };
  const change = async (row, path, body) => {
    // The row's controls, and the CV head's while it shows this row – the same
    // ones are freed again, even if the head has moved on to someone else.
    const held = $$('.decide button, select.score, .order button', row).concat(row === current ? $$('#v-decide button, #v-score') : []);
    held.forEach((el) => (el.disabled = true));
    try { apply(await post(path, body)); say($('#list-msg'), ''); }
    catch (err) { say($('#list-msg'), err.message, true); }
    held.forEach((el) => (el.disabled = false));
    orderButtons();
  };
  const decideTo = (row, d) => change(row, '/decision', { submissions: [Number(row.dataset.id)], decision: d });
  // A button pressed again takes its decision back; a key never does (see below).
  const decideOn = (row, d) => decideTo(row, row.dataset.decision === d ? null : d);
  const rate = (row, value) => {
    const score = value === '' || value == null ? null : Number(value);
    if (String(score ?? '') === (row.dataset.score || '')) return;
    return change(row, '/score', { submissions: [Number(row.dataset.id)], score });
  };
  const move = async (row, direction) => {
    await change(row, '/waitlist', { submission: Number(row.dataset.id), direction });
    const again = $('.order [data-dir="' + direction + '"]', row);
    (again && !again.disabled ? again : $('.pick', row)).focus();
  };

  list.addEventListener('click', (e) => {
    const row = e.target.closest('.person'); if (!row) return;
    const btn = e.target.closest('.decide button'), dir = e.target.closest('.order button');
    if (btn) decideOn(row, btn.dataset.d);
    else if (dir) move(row, dir.dataset.dir);
    else if (e.target.closest('.pick') || (side() && !e.target.closest('a, select'))) select(row);
  });
  list.addEventListener('change', (e) => {
    const sel = e.target.closest('select.score'); if (!sel) return;
    rate(e.target.closest('.person'), sel.value);
  });
  if (viewer) {
    $('#v-decide').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && current) decideOn(current, b.dataset.d); });
    const vs = $('#v-score'); if (vs) vs.addEventListener('change', () => current && rate(current, vs.value));
  }

  // ---- keys, for going through a long list: ↑/↓ the next person, A / W / D
  // decide, 1–9 and 0 (= 10) rate. Not while typing or in a menu. A key only
  // ever sets a decision – pressing A twice leaves the person admitted, so a
  // double press cannot quietly undo one; taking a decision back is a click.
  // Without an extra on the link, only ↑/↓ on a name, as it always was.
  const step = (from, by) => {
    const rs = visible(), to = rs[rs.indexOf(from) + by];
    if (!to) return;
    $('.pick', to).focus();
    if (side()) select(to);
  };
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, select, textarea, a[href]')) return;
    if (!keyed && !(e.target.classList && e.target.classList.contains('pick'))) return;
    const row = keyed && side() ? current : e.target.closest && e.target.closest('.person');
    if (!row) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); step(row, e.key === 'ArrowDown' ? 1 : -1); return; }
    if (!keyed) return;
    const d = (waiting ? { a: 'admitted', w: 'waitlisted', d: 'declined' } : { a: 'admitted', d: 'declined' })[e.key.toLowerCase()];
    if (d) { e.preventDefault(); if (row.dataset.decision !== d) decideTo(row, d); return; }
    if (rated && /^[0-9]$/.test(e.key)) { e.preventDefault(); rate(row, e.key === '0' ? 10 : Number(e.key)); }
  });

  bulk.addEventListener('click', async () => {
    const open = rows().filter((r) => r.dataset.decision === '').map((r) => Number(r.dataset.id));
    if (!open.length) return;
    if (!bulk.dataset.armed) { bulk.dataset.armed = '1'; bulk.textContent = 'Admit ' + open.length + (open.length === 1 ? ' person' : ' people') + '? Click again'; setTimeout(() => { if (bulk.dataset.armed) counts(); }, 5000); return; }
    bulk.disabled = true; say($('#list-msg'), 'Saving…');
    try { apply(await post('/decision', { submissions: open, decision: 'admitted' })); say($('#list-msg'), ''); }
    catch (err) { say($('#list-msg'), err.message, true); counts(); }
  });
  $('#sign-out').addEventListener('click', async () => { await post('/sign-out').catch(() => {}); location.reload(); });
  counts(); show(true);
  if (side() && visible()[0]) select(visible()[0]);
})();
`;

const eveningLine = (e: Evening | null) =>
  e
    ? [e.label.split(' · ')[0], e.time, e.location].filter(Boolean).map((x) => esc(String(x))).join(' · ')
    : '';

type Extras = { rating: boolean; waitlist: boolean };

const DECISIONS = [
  { value: 'admitted', label: 'Admit', key: 'A' },
  { value: 'waitlisted', label: 'Waitlist', key: 'W' },
  { value: 'declined', label: 'Decline', key: 'D' },
] as const;

/** Admit and Decline – and Waitlist between them on a link with a waitlist. The keys only with an extra on. */
const decideButtons = (decision: HostRow['decision'], x: Extras) =>
  DECISIONS.filter((d) => x.waitlist || d.value !== 'waitlisted')
    .map((d) => {
      const title = x.rating || x.waitlist ? ` title="${d.label} (${d.key})"` : '';
      return `<button type="button" data-d="${d.value}" aria-pressed="${decision === d.value}"${title}>${d.label}</button>`;
    })
    .join('\n      ');

/** The 1–10 rating as a menu: "–" for none yet. */
const scoreMenu = (score: number | null, attrs: string) =>
  `<select class="score${score ? ' set' : ''}" ${attrs}><option value="">–</option>${Array.from({ length: 10 }, (_, i) => i + 1)
    .map((n) => `<option value="${n}"${n === score ? ' selected' : ''}>${n}</option>`)
    .join('')}</select>`;

/** "Waitlist #2", or "From the waitlist" for someone who moved up on their own. */
const tagOf = (r: HostRow) =>
  r.waitlist
    ? `<span class="tag wl" title="Place on the waitlist – #1 moves up first">Waitlist #${r.waitlist}</span>`
    : r.movedUpAt
      ? `<span class="tag up" title="Moved up from the waitlist on ${esc(fmtDay.format(new Date(r.movedUpAt)))} – we told them">From the waitlist</span>`
      : '<span class="tag hidden"></span>';

const ORDER_BUTTONS = `<span class="order" role="group" aria-label="Place on the waitlist"><button type="button" data-dir="up" aria-label="Move up the waitlist" title="Move up">↑</button><button type="button" data-dir="down" aria-label="Move down the waitlist" title="Move down">↓</button></span>`;

const keysLine = (x: Extras) =>
  `<p class="v-keys">Keys: <kbd>↑</kbd> <kbd>↓</kbd> next person · <kbd>A</kbd> admit${x.waitlist ? ' · <kbd>W</kbd> waitlist' : ''} · <kbd>D</kbd> decline${x.rating ? ' · <kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd> = 10 rating' : ''}</p>`;

const viewer = (x: Extras) => `<section class="viewer" id="viewer" aria-label="CV">
    <div class="v-head hidden" id="v-head">
      <div class="v-who"><strong id="v-name"></strong><div id="v-meta"></div></div>
      <div class="v-act">
        <a class="cv" id="v-open" target="_blank" rel="noopener" title="Open the CV in a new tab">New tab ↗</a>${
          x.rating ? `\n        ${scoreMenu(null, 'id="v-score" aria-label="Rating" title="Rating, 1–10 (keys 1–9, 0 = 10)"')}` : ''
        }
        <div class="decide" id="v-decide" role="group" aria-label="Decision">
          ${decideButtons(null, x)}
        </div>
      </div>
    </div>
    <div class="v-body" id="v-body"><p class="v-empty">Pick someone on the left to see their CV.</p></div>${
      x.rating || x.waitlist ? `\n    ${keysLine(x)}` : ''
    }
  </section>`;

const frame = (input: PageInput, title: string, body: string, base = '', side = '', x: Extras = { rating: false, waitlist: false }) => {
  const classes = [side && 'wide', x.rating && 'rated', x.waitlist && 'waiting'].filter(Boolean).join(' ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(title)} – Coding for Change</title>
<style nonce="${input.nonce}">${STYLE}</style>
</head>
<body data-base="${esc(base)}"${classes ? ` class="${classes}"` : ''}>
<div class="page">
<div class="top">${LOGO_SVG}<span class="muted mono">Munich Tech Tour</span></div>
<main>${body}</main>
<footer>Coding for Change e.V. · <a href="${esc(input.siteOrigin)}/privacy">Privacy policy</a> · <a href="mailto:${esc(input.contactEmail)}">${esc(input.contactEmail)}</a></footer>
</div>
${side}
<script nonce="${input.nonce}">${SCRIPT}</script>
</body>
</html>`;
};

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

  const x: Extras = { rating: input.rating, waitlist: input.waitlist };
  const rows = input.rows
    .map(
      (r, i) => `<li class="person" data-id="${r.id}" data-n="${i + 1}" data-decision="${r.decision ?? ''}"${x.rating ? ` data-score="${r.score ?? ''}"` : ''}${x.waitlist ? ` data-waitlist="${r.waitlist ?? ''}"` : ''}>
  <span class="n">${i + 1}</span>
  <div class="who">
    <div class="name"><button type="button" class="pick" aria-controls="viewer">${esc(r.name)}</button>${r.member ? MEMBER_BADGE : ''}${x.waitlist ? tagOf(r) : ''}</div>
    <small>registered ${esc(fmtDay.format(new Date(r.registeredAt)))}${r.hasCv ? '' : '<span class="nocv"> · no CV</span>'}</small>
    ${r.details.length ? `<p class="details">${r.details.map((d) => `<span>${esc(d.label)}:</span> ${esc(d.value)}`).join(' · ')}</p>` : ''}
  </div>
  <div class="act">${x.waitlist ? `\n    ${ORDER_BUTTONS}` : ''}${
    x.rating ? `\n    ${scoreMenu(r.score, `aria-label="Rating for ${esc(r.name)}" title="Rating, 1–10"`)}` : ''
  }
    ${r.hasCv ? `<a class="cv" href="${base}/cv/${r.id}" target="_blank" rel="noopener">CV ↗</a>` : '<span class="cv none">No CV</span>'}
    <div class="decide" role="group" aria-label="Decision for ${esc(r.name)}">
      ${decideButtons(r.decision, x)}
    </div>
  </div>
</li>`,
    )
    .join('\n');
  const rules = `<strong>Please use these registrations only to decide who joins your evening and to prepare it</strong> (for example access to your building), and delete any CVs you downloaded once the evening is over. Your decisions reach us right away – we let everyone know. Questions: <a href="mailto:${esc(input.contactEmail)}">${esc(input.contactEmail)}</a>`;
  const extrasNote = [
    x.waitlist
      ? `<strong>Waitlist:</strong> the people you would take if a spot frees up, the next to move up first${x.rating ? ' – by your rating, and within the same rating as you order them with ↑/↓' : ' – change the order with ↑/↓'}.${
          input.movingUp
            ? ' When someone you admitted gives up the evening, the first on the waitlist moves up: we admit them and tell them right away, and you see them here as admitted.'
            : ''
        }`
      : '',
    x.rating ? 'Your ratings are seen only by your team and us.' : '',
  ]
    .filter(Boolean)
    .join(' ');
  // The notice ends the list, so it scrolls with it when the header stands still.
  const list = `<ol class="people">${rows}</ol>
  <p class="empty${input.rows.length ? ' hidden' : ''}" id="none">${input.rows.length ? 'Nobody in this view.' : 'Nobody has registered for this evening yet.'}</p>
  ${extrasNote ? `<aside class="notice"><p>${rules}</p><p>${extrasNote}</p></aside>` : `<aside class="notice">${rules}</aside>`}`;

  return frame(
    input,
    input.title,
    `${head}
<section class="card" aria-label="Registrations">
  <div class="bar">
    <div class="counts">
      <div class="count"><b>${input.rows.length}</b><span>registered</span></div>
      <div class="count"><b id="c-admitted">0</b><span>admitted</span></div>${
        x.waitlist ? '\n      <div class="count"><b id="c-waitlisted">0</b><span>waitlist</span></div>' : ''
      }
      <div class="count"><b id="c-declined">0</b><span>declined</span></div>
      <div class="count"><b id="c-open">0</b><span>still open</span></div>
    </div>
    <button type="button" id="admit-open">Admit everyone still open</button>
  </div>
  <div class="tools">
    <div class="view">
      <div class="seg" id="filter" role="group" aria-label="Show">
        <button type="button" data-filter="all" aria-pressed="true">All</button>
        <button type="button" data-filter="open" aria-pressed="false">Open</button>
        <button type="button" data-filter="admitted" aria-pressed="false">Admitted</button>${
          x.waitlist ? '\n        <button type="button" data-filter="waitlisted" aria-pressed="false">Waitlist</button>' : ''
        }
        <button type="button" data-filter="declined" aria-pressed="false">Declined</button>
      </div>${
        x.rating
          ? `
      <span class="sort-label" id="sort-label">Sort</span>
      <div class="seg" id="sort" role="group" aria-labelledby="sort-label">
        <button type="button" data-sort="registered" aria-pressed="true">Registered</button>
        <button type="button" data-sort="rating" aria-pressed="false">Rating</button>
      </div>`
          : ''
      }
      <a class="cv none" id="cv-all" title="One ZIP file with the CVs of everyone shown">No CVs to download</a>
    </div>
    <span class="who-am-i">Signed in as ${esc(input.email)} · <button type="button" class="linkish" id="sign-out">Sign out</button></span>
  </div>
  <p class="msg list-msg" id="list-msg" role="status"></p>
  <div class="list">${list}</div>
</section>`,
    base,
    input.rows.length ? viewer(x) : '',
    x,
  );
}
