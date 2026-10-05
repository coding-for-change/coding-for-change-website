'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { REVIEW_SCORE_MAX, REVIEW_SCORE_MIN, REVIEW_STATUSES } from '../../fields/review';
import {
  answerRows,
  byEmail,
  choiceFieldOf,
  choiceKeysOf,
  filesOf,
  formIdOf,
  personOf,
  SORTS,
  sortSubmissions,
  summaryOf,
  type FileDoc,
  type FormDoc,
  type ReviewStatus,
  type SortKey,
  type Submission,
} from './model';
import './review.css';

/**
 * /admin/review – go through the applications (or TechTour registrations) one
 * by one: the answers under their questions, the CV beside them, a score from
 * 1 to 10, a decision and notes. Everything saves as it is set, to the same
 * fields the submission's own admin page and the Excel export use.
 *
 * Keyboard: ↑/↓ (or K/J) move through the list, 1–9 and 0 (= 10) score,
 * A / U / R decide, N jumps to the notes, / to the search.
 */

type Props = { apiRoute: string };

/** These two first, in this order; any other form after them, by title. */
const FORM_ORDER = ['application', 'techtour'];
const FORM_NAMES: Record<string, string> = { application: 'Applications', techtour: 'TechTour' };
const formName = (f: FormDoc) => FORM_NAMES[f.title.trim().toLowerCase()] ?? f.title;

const DECISIONS = REVIEW_STATUSES.filter((s) => s.value !== 'unreviewed');
const DECISION_KEYS: Record<string, ReviewStatus> = { a: 'accepted', u: 'unsure', r: 'rejected' };
const SCORES = Array.from(
  { length: REVIEW_SCORE_MAX - REVIEW_SCORE_MIN + 1 },
  (_, i) => REVIEW_SCORE_MIN + i,
);

type StatusFilter = 'all' | ReviewStatus;
type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type ReviewPatch = Partial<Pick<Submission, 'reviewScore' | 'reviewStatus' | 'reviewNotes'>>;

const statusOf = (s: Submission): ReviewStatus => s.reviewStatus ?? 'unreviewed';

const when = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', day: 'numeric', month: 'short' });

/** Every document of a REST list, page by page. */
async function fetchAll<T>(url: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(`${url}&limit=200&page=${page}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = (await res.json()) as { docs: T[]; hasNextPage?: boolean };
    out.push(...data.docs);
    if (!data.hasNextPage) break;
  }
  return out;
}

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(
    el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable),
  );
};

export function ReviewWorkspace({ apiRoute }: Props) {
  const [forms, setForms] = useState<FormDoc[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [files, setFiles] = useState<Map<number, FileDoc>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [formId, setFormId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [choiceFilter, setChoiceFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [notes, setNotes] = useState('');

  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // ---- load ----------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [formDocs, subDocs, fileDocs] = await Promise.all([
          fetchAll<FormDoc>(`${apiRoute}/forms?depth=0&locale=en`),
          fetchAll<Submission>(`${apiRoute}/form-submissions?depth=0&sort=-createdAt`),
          fetchAll<FileDoc>(`${apiRoute}/applicant-files?depth=0`),
        ]);
        if (cancelled) return;
        setForms(formDocs);
        setSubs(subDocs);
        setFiles(new Map(fileDocs.map((f) => [f.id, f])));
      } catch (err) {
        if (!cancelled) setError(`Could not load the submissions (${(err as Error).message}).`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiRoute, reloadKey]);

  // ---- forms, in a fixed order, with their counts ----------------------------
  const counts = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of subs) map.set(formIdOf(s), (map.get(formIdOf(s)) ?? 0) + 1);
    return map;
  }, [subs]);

  const tabs = useMemo(() => {
    const rank = (f: FormDoc) => {
      const i = FORM_ORDER.indexOf(f.title.trim().toLowerCase());
      return i === -1 ? FORM_ORDER.length : i;
    };
    return forms
      .filter((f) => rank(f) < FORM_ORDER.length || (counts.get(f.id) ?? 0) > 0)
      .sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
  }, [forms, counts]);

  // Start where the URL says (?form=techtour&id=12), else on the first tab.
  useEffect(() => {
    if (loading || formId !== null || tabs.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const wantedForm = params.get('form')?.toLowerCase();
    const wantedId = Number(params.get('id'));
    const fromUrl = tabs.find((f) => f.title.trim().toLowerCase() === wantedForm);
    const sub = subs.find((s) => s.id === wantedId);
    const start = sub ? tabs.find((f) => f.id === formIdOf(sub)) : (fromUrl ?? tabs[0]);
    setFormId(start?.id ?? tabs[0].id);
    if (sub) setSelectedId(sub.id);
  }, [loading, formId, tabs, subs]);

  const form = useMemo(() => forms.find((f) => f.id === formId), [forms, formId]);
  const choiceField = useMemo(() => choiceFieldOf(form), [form]);
  const people = useMemo(() => byEmail(subs), [subs]);
  const formTitleById = useMemo(() => new Map(forms.map((f) => [f.id, f])), [forms]);

  // ---- the list --------------------------------------------------------------
  const inForm = useMemo(() => subs.filter((s) => formIdOf(s) === formId), [subs, formId]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: inForm.length };
    for (const s of inForm) c[statusOf(s)] = (c[statusOf(s)] ?? 0) + 1;
    return c;
  }, [inForm]);
  const scored = useMemo(() => inForm.filter((s) => s.reviewScore != null).length, [inForm]);

  const matches = useCallback(
    (s: Submission) => {
      if (statusFilter !== 'all' && statusOf(s) !== statusFilter) return false;
      if (choiceField?.name && choiceFilter !== 'all' && !choiceKeysOf(form, s, choiceField.name).includes(choiceFilter))
        return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const { name, email } = personOf(s);
      return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
    },
    [statusFilter, choiceFilter, choiceField, form, query],
  );

  // The one being reviewed stays in the list until you move on, even once its
  // new decision no longer matches the filter…
  const list = useMemo(
    () => sortSubmissions(inForm.filter((s) => matches(s) || s.id === selectedId), sort),
    [inForm, matches, sort, selectedId],
  );

  // …but a new filter applies to it too: if it does not match, start at the top.
  useEffect(() => {
    setSelectedId((id) => {
      const current = inForm.find((s) => s.id === id);
      if (current && matches(current)) return id;
      return sortSubmissions(inForm.filter(matches), sort)[0]?.id ?? null;
    });
    // Only on a change of filter – not when the selected person's decision changes.
  }, [statusFilter, choiceFilter, query]);

  const selected = useMemo(
    () => list.find((s) => s.id === selectedId) ?? null,
    [list, selectedId],
  );
  const position = selected ? list.indexOf(selected) : -1;

  // Nothing selected (or it left this form): take the first in the list.
  useEffect(() => {
    if (formId === null) return;
    if (!selected && list.length > 0) setSelectedId(list[0].id);
  }, [formId, selected, list]);

  // Keep the URL pointing at what is on screen, so it can be bookmarked or sent on.
  useEffect(() => {
    if (!form) return;
    const params = new URLSearchParams(window.location.search);
    params.set('form', form.title.trim().toLowerCase());
    if (selected) params.set('id', String(selected.id));
    else params.delete('id');
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
  }, [form, selected]);

  // Scroll the selected row into view when moving with the keyboard.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-id="${selectedId}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  // ---- saving ------------------------------------------------------------------
  // One queue per submission, so quick successive edits reach the server in order.
  const queues = useRef(new Map<number, Promise<void>>());

  const save = useCallback(
    (id: number, patch: ReviewPatch) => {
      let previous: ReviewPatch = {};
      setSubs((all) =>
        all.map((s) => {
          if (s.id !== id) return s;
          previous = Object.fromEntries(Object.keys(patch).map((k) => [k, s[k as keyof ReviewPatch] ?? null]));
          return { ...s, ...patch };
        }),
      );
      setSaveState('saving');
      const run = async () => {
        const res = await fetch(`${apiRoute}/form-submissions/${id}?depth=0`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(String(res.status));
      };
      const next = (queues.current.get(id) ?? Promise.resolve()).then(run).then(
        () => setSaveState('saved'),
        () => {
          setSubs((all) => all.map((s) => (s.id === id ? { ...s, ...previous } : s)));
          setSaveState('error');
        },
      );
      queues.current.set(id, next);
    },
    [apiRoute],
  );

  // Notes: typed into a draft, saved a moment after the last keystroke, on
  // leaving the box, and before moving to someone else.
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesFor = useRef<{ id: number; value: string } | null>(null);

  const flushNotes = useCallback(() => {
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = null;
    const pending = notesFor.current;
    notesFor.current = null;
    if (!pending) return;
    const current = subs.find((s) => s.id === pending.id);
    if ((current?.reviewNotes ?? '') !== pending.value) save(pending.id, { reviewNotes: pending.value });
  }, [subs, save]);

  // A new person resets the box; a save (new object, same person) must not.
  const subsRef = useRef(subs);
  subsRef.current = subs;
  const notesSubject = selected?.id ?? null;
  useEffect(() => {
    setNotes(subsRef.current.find((s) => s.id === notesSubject)?.reviewNotes ?? '');
  }, [notesSubject]);

  const onNotesChange = (value: string) => {
    if (!selected) return;
    setNotes(value);
    notesFor.current = { id: selected.id, value };
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(flushNotes, 800);
  };

  const select = useCallback(
    (id: number | null) => {
      flushNotes();
      setSelectedId(id);
      setSaveState('idle');
    },
    [flushNotes],
  );

  const move = useCallback(
    (by: number) => {
      if (list.length === 0) return;
      const at = position === -1 ? 0 : Math.min(list.length - 1, Math.max(0, position + by));
      select(list[at].id);
    },
    [list, position, select],
  );

  const setScore = useCallback(
    (score: number) => {
      if (!selected) return;
      save(selected.id, { reviewScore: selected.reviewScore === score ? null : score });
    },
    [selected, save],
  );

  const setDecision = useCallback(
    (status: ReviewStatus) => {
      if (!selected) return;
      save(selected.id, { reviewStatus: statusOf(selected) === status ? 'unreviewed' : status });
    },
    [selected, save],
  );

  // ---- keyboard ----------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'arrowdown' || key === 'j') move(1);
      else if (key === 'arrowup' || key === 'k') move(-1);
      else if (/^[0-9]$/.test(key)) setScore(key === '0' ? 10 : Number(key));
      else if (DECISION_KEYS[key]) setDecision(DECISION_KEYS[key]);
      else if (key === 'n') notesRef.current?.focus();
      else if (key === '/') searchRef.current?.focus();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, setScore, setDecision]);

  // Leaving the page with a note still waiting to be saved.
  useEffect(() => {
    const onLeave = () => flushNotes();
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
  }, [flushNotes]);

  const switchForm = (id: number) => {
    flushNotes();
    setFormId(id);
    setSelectedId(null);
    setChoiceFilter('all');
    setStatusFilter('all');
  };

  // ---- render --------------------------------------------------------------------
  if (loading) return <div className="rv rv--message">Loading submissions…</div>;
  if (error)
    return (
      <div className="rv rv--message" role="alert">
        <p>{error}</p>
        <button type="button" className="rv-btn" onClick={() => setReloadKey((k) => k + 1)}>
          Try again
        </button>
      </div>
    );
  if (tabs.length === 0) return <div className="rv rv--message">No forms yet.</div>;

  const person = selected ? personOf(selected) : null;
  const rows = selected ? answerRows(form, selected) : [];
  const cvs = selected ? filesOf(selected, files) : [];
  const others = selected && person?.email ? (people.get(person.email.toLowerCase()) ?? []).filter((s) => s.id !== selected.id) : [];
  const exportHref = form ? `${apiRoute}/submissions-export.xlsx?form=${encodeURIComponent(form.title)}` : undefined;

  return (
    <div className="rv">
      <header className="rv-head">
        <div>
          <h1 className="rv-head__title">Review</h1>
          <p className="rv-head__sub">
            {scored} of {inForm.length} scored · {statusCounts.accepted ?? 0} accepted ·{' '}
            {statusCounts.unsure ?? 0} unsure · {statusCounts.rejected ?? 0} rejected
          </p>
        </div>
        <div className="rv-head__actions">
        {exportHref && (
          <a className="rv-link" href={exportHref} download>
            Download as Excel
          </a>
        )}
        <nav className="rv-tabs" aria-label="Forms">
          {tabs.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`rv-tab${f.id === formId ? ' is-active' : ''}`}
              aria-pressed={f.id === formId}
              onClick={() => switchForm(f.id)}
            >
              {formName(f)} <span className="rv-tab__count">{counts.get(f.id) ?? 0}</span>
            </button>
          ))}
        </nav>
        </div>
      </header>

      <div className="rv-toolbar">
        <input
          ref={searchRef}
          className="rv-search"
          type="search"
          placeholder="Search name or email  ( / )"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && (e.currentTarget as HTMLInputElement).blur()}
        />
        <div className="rv-chips" role="group" aria-label="Decision">
          {(['all', 'unreviewed', ...DECISIONS.map((d) => d.value)] as StatusFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`rv-chip${statusFilter === key ? ' is-active' : ''}`}
              aria-pressed={statusFilter === key}
              onClick={() => setStatusFilter(key)}
            >
              {key !== 'all' && <span className={`rv-dot rv-dot--${key}`} aria-hidden />}
              {key === 'all' ? 'All' : REVIEW_STATUSES.find((s) => s.value === key)?.label}
              <span className="rv-chip__count">{statusCounts[key] ?? 0}</span>
            </button>
          ))}
        </div>
        {choiceField?.name && (
          <select
            className="rv-select"
            value={choiceFilter}
            onChange={(e) => setChoiceFilter(e.target.value)}
            aria-label={choiceField.label ?? choiceField.name}
          >
            <option value="all">Every option</option>
            {(choiceField.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <select className="rv-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rv-body">
        <div className="rv-list" ref={listRef} role="listbox" aria-label="Submissions">
          {list.length === 0 && <p className="rv-empty">Nothing here with these filters.</p>}
          {list.map((s) => {
            const p = personOf(s);
            const score = s.reviewScore;
            const also = (people.get(p.email.toLowerCase()) ?? []).filter((o) => o.id !== s.id);
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={s.id === selectedId}
                data-id={s.id}
                className={`rv-item${s.id === selectedId ? ' is-active' : ''}`}
                onClick={() => select(s.id)}
              >
                <span className={`rv-dot rv-dot--${statusOf(s)}`} aria-hidden />
                <span className="rv-item__main">
                  <span className="rv-item__name">{p.name}</span>
                  <span className="rv-item__meta">
                    {day.format(new Date(s.createdAt))}
                    {summaryOf(form, s) && ` · ${summaryOf(form, s)}`}
                  </span>
                </span>
                <span className="rv-item__side">
                  {also.length > 0 && (
                    <span className="rv-tag" title={also.map((o) => formName(formTitleById.get(formIdOf(o)) ?? { id: 0, title: '?' })).join(', ')}>
                      +{also.length}
                    </span>
                  )}
                  <span className={`rv-score${score == null ? ' rv-score--none' : ''}`}>{score ?? '–'}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className={`rv-main${cvs.length ? '' : ' rv-main--no-cv'}`}>
        {selected && person ? (
          <article className="rv-detail" aria-label={person.name}>
            <header className="rv-person">
              <div className="rv-person__who">
                <h2 className="rv-person__name">{person.name}</h2>
                <p className="rv-person__meta">
                  {person.email && <a href={`mailto:${person.email}`}>{person.email}</a>}
                  <span>{when.format(new Date(selected.createdAt))}</span>
                  {selected.language && <span className="rv-lang">{selected.language.toUpperCase()}</span>}
                </p>
              </div>
              <div className="rv-person__nav">
                <button type="button" className="rv-btn rv-btn--icon" onClick={() => move(-1)} disabled={position <= 0} aria-label="Previous (↑)">
                  ↑
                </button>
                <span className="rv-person__pos">
                  {position + 1} / {list.length}
                </span>
                <button
                  type="button"
                  className="rv-btn rv-btn--icon"
                  onClick={() => move(1)}
                  disabled={position >= list.length - 1}
                  aria-label="Next (↓)"
                >
                  ↓
                </button>
              </div>
            </header>

            <section className="rv-panel" aria-label="Your review">
              <div className="rv-panel__row">
                <span className="rv-panel__label">Score</span>
                <div className="rv-scale" role="group" aria-label="Score from 1 to 10">
                  {SCORES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`rv-scale__btn${selected.reviewScore === n ? ' is-active' : ''}`}
                      aria-pressed={selected.reviewScore === n}
                      onClick={() => setScore(n)}
                      title={n === 10 ? 'Key 0' : `Key ${n}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rv-panel__row">
                <span className="rv-panel__label">Decision</span>
                <div className="rv-decisions" role="group" aria-label="Decision">
                  {DECISIONS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      className={`rv-decision rv-decision--${d.value}${statusOf(selected) === d.value ? ' is-active' : ''}`}
                      aria-pressed={statusOf(selected) === d.value}
                      onClick={() => setDecision(d.value)}
                      title={`Key ${d.label.charAt(0)}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <span className={`rv-save rv-save--${saveState}`} aria-live="polite">
                  {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Not saved – try again' : ''}
                </span>
              </div>
              <textarea
                ref={notesRef}
                className="rv-notes"
                rows={2}
                placeholder="Notes – only the team sees these  ( N )"
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                onBlur={flushNotes}
                onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
              />
            </section>

            {others.length > 0 && (
              <section className="rv-others" aria-label="Same email elsewhere">
                {others.map((o) => {
                  const of = formTitleById.get(formIdOf(o));
                  const choice = choiceFieldOf(of);
                  const picked = choice?.name ? choiceKeysOf(of, o, choice.name) : [];
                  const labels = picked.map((k) => choice?.options?.find((x) => x.value === k)?.label ?? k);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className="rv-other"
                      onClick={() => {
                        if (formIdOf(o) !== formId) {
                          flushNotes();
                          setFormId(formIdOf(o));
                        }
                        setStatusFilter('all');
                        setChoiceFilter('all');
                        setQuery('');
                        select(o.id);
                      }}
                    >
                      <strong>{formIdOf(o) === formId ? 'Also sent this form' : `Also in ${of ? formName(of) : 'another form'}`}</strong>
                      <span>
                        {day.format(new Date(o.createdAt))}
                        {labels.length > 0 && ` · ${labels.join(', ')}`}
                        {o.reviewScore != null && ` · score ${o.reviewScore}`}
                      </span>
                    </button>
                  );
                })}
              </section>
            )}

            <section className="rv-answers">
              {rows.filter((r) => r.kind === 'short').length > 0 && (
                <dl className="rv-facts">
                  {rows.map((r) =>
                    r.kind === 'short' ? (
                      <div key={r.name} className="rv-fact">
                        <dt>{r.label}</dt>
                        <dd>{r.value}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              )}
              {rows.map((r) => {
                if (r.kind === 'long')
                  return (
                    <div key={r.name} className="rv-qa">
                      <h3 className="rv-qa__q">{r.label}</h3>
                      <p className="rv-qa__a">{r.value || '–'}</p>
                      <span className="rv-qa__len">{r.value.length} characters</span>
                    </div>
                  );
                if (r.kind === 'choices')
                  return (
                    <div key={r.name} className="rv-qa">
                      <h3 className="rv-qa__q">{r.label}</h3>
                      <ul className="rv-picks">
                        {r.values.length ? r.values.map((v) => <li key={v}>{v}</li>) : <li>–</li>}
                      </ul>
                    </div>
                  );
                return null;
              })}
              {rows.some((r) => r.kind === 'confirm' || r.kind === 'linked') && (
                <ul className="rv-confirms" aria-label="Boxes">
                  {rows.map((r) =>
                    r.kind === 'confirm' || r.kind === 'linked' ? (
                      <li key={r.name} className={r.checked ? 'is-checked' : ''}>
                        <span aria-hidden>{r.checked ? '✓' : '–'}</span> {r.label}
                      </li>
                    ) : null,
                  )}
                </ul>
              )}
            </section>
          </article>
        ) : (
          <div className="rv-detail rv-empty">Pick someone from the list.</div>
        )}

        {selected && cvs.length > 0 && <CvViewer key={selected.id} files={cvs} name={person?.name ?? ''} />}
        </div>
      </div>

      <p className="rv-keys">
        <kbd>↑</kbd> <kbd>↓</kbd> move · <kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd> score · <kbd>A</kbd> <kbd>U</kbd> <kbd>R</kbd>{' '}
        decide · <kbd>N</kbd> notes · <kbd>/</kbd> search. Saved as you go, one shared review per person.
      </p>
    </div>
  );
}

/** The CV beside the answers, in the browser's own PDF viewer. */
function CvViewer({ files, name }: { files: FileDoc[]; name: string }) {
  const [at, setAt] = useState(0);
  const file = files[Math.min(at, files.length - 1)];
  return (
    <section className="rv-cv" aria-label="CV">
      <div className="rv-cv__bar">
        {files.length > 1 ? (
          files.map((f, i) => (
            <button key={f.id} type="button" className={`rv-chip${i === at ? ' is-active' : ''}`} onClick={() => setAt(i)}>
              {f.filename}
            </button>
          ))
        ) : (
          <span className="rv-cv__name">{file.filename}</span>
        )}
        <a className="rv-link" href={file.url ?? '#'} target="_blank" rel="noreferrer">
          Open in new tab ↗
        </a>
      </div>
      <iframe className="rv-cv__frame" src={`${file.url}#navpanes=0&view=FitH`} title={`CV of ${name}`} />
    </section>
  );
}
