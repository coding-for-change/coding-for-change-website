'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner, Button, CheckboxInput, ConfirmationModal, SetStepNav, useModal, ViewDescription } from '@payloadcms/ui';
import { normalizeAddress } from '../../lib/onboarding/cfcEmail';
import { manualAddresses } from '../../lib/onboarding/manual';
import type { AdmittedPerson, OnboardingMember, OnboardingOverview } from '../../lib/onboarding/types';
import { PageHeader } from '../shared/PageHeader';
import './onboarding.css';

/**
 * /admin/onboarding (OnboardingView.tsx): three lists over
 * GET /api/onboarding/admin/overview (endpoints/onboarding.ts).
 *
 * - Admitted: applications at stage "admitted" without an account. The board
 *   checks names and the proposed address, selects people and creates their
 *   accounts; the answer is the one-time ZIP (Google CSV + password sheets).
 *   "Add person" adds rows for people the board contacted directly (no
 *   application). They live only in this component's state until the
 *   accounts are created (no storage of any kind), and go into the same
 *   request and the same ZIP (lib/onboarding/manual.ts).
 * - In onboarding: per member what they have done, the board's to-dos, title,
 *   project and the profile's publication. Accounts can be exported again
 *   with new passwords when a download got lost.
 * - Completed: everything done.
 */

type Props = { apiRoute: string; adminRoute: string };

type Draft = { selected: boolean; firstName: string; lastName: string; email: string };

/** Someone added by hand. `edited`: the board typed the address, so it is no longer re-proposed from the names. */
type ManualDraft = {
  key: number;
  selected: boolean;
  firstName: string;
  lastName: string;
  privateEmail: string;
  email: string;
  edited: boolean;
};

const CREATE_MODAL = 'onboarding-create';
const REISSUE_MODAL = 'onboarding-reissue';

const when = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' });
const day = (iso: string | null) => (iso ? when.format(new Date(iso)) : null);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const fullName = (m: { firstName: string; lastName: string; email: string }) =>
  `${m.firstName} ${m.lastName}`.trim() || m.email;

const admittedName = (data: OnboardingOverview | null, application: number) => {
  const p = data?.admitted.find((a) => a.application === application);
  return p ? fullName({ ...p, email: p.privateEmail }) : `Application ${application}`;
};

const DOCUMENT_STATUS: Record<string, string> = {
  not_started: 'Not started',
  pending: 'Started',
  opened: 'Opened',
  completed: 'Signed',
  declined: 'Declined',
  expired: 'Expired',
};

/** Save a fetched file the way a link with `download` would. */
async function saveDownload(res: Response) {
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'cfc-accounts.zip';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Problem = { application?: number; manual?: number; user?: number; message: string };

export function OnboardingDashboard({ apiRoute, adminRoute }: Props) {
  const { openModal } = useModal();
  const [data, setData] = useState<OnboardingOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [reissue, setReissue] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<ManualDraft[]>([]);
  // The keys of the manual rows in the last request, in order: problems name them by index.
  const [sentManual, setSentManual] = useState<number[]>([]);
  const nextKey = useRef(1);
  const focusKey = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiRoute}/onboarding/admin/overview`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const next = (await res.json()) as OnboardingOverview;
      setData(next);
      // Keep what the board typed for people still waiting; new ones get the proposal.
      setDrafts((old) =>
        Object.fromEntries(
          next.admitted.map((p) => [
            p.application,
            old[p.application] ?? { selected: false, firstName: p.firstName, lastName: p.lastName, email: p.proposedEmail ?? '' },
          ]),
        ),
      );
      setReissue((old) => new Set([...old].filter((id) => next.members.some((m) => m.id === id))));
    } catch (err) {
      setError(`Could not load the onboarding (${(err as Error).message}).`);
    }
  }, [apiRoute]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => (data?.admitted ?? []).filter((p) => drafts[p.application]?.selected),
    [data, drafts],
  );
  // The address each manual row shows: typed, or proposed free of every
  // account, every applicant row and the manual rows above it.
  const manualEmails = useMemo(
    () =>
      data
        ? manualAddresses(
            manual,
            data.domain,
            data.accountAddresses,
            data.admitted.map((p) => drafts[p.application]?.email ?? ''),
          )
        : [],
    [data, drafts, manual],
  );
  const manualSelected = manual.filter((m) => m.selected);
  const selectedCount = selected.length + manualSelected.length;
  const rowCount = (data?.admitted.length ?? 0) + manual.length;
  const emailOf = (m: ManualDraft) => manualEmails[manual.indexOf(m)] ?? '';
  const appliedToo = (m: ManualDraft) => {
    const own = normalizeAddress(m.privateEmail);
    return own ? data?.admitted.find((p) => p.privateEmail && normalizeAddress(p.privateEmail) === own) : undefined;
  };

  const setManualRow = (key: number, patch: Partial<ManualDraft>) =>
    setManual((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addPerson = () => {
    const key = nextKey.current++;
    focusKey.current = key;
    setManual((rows) => [...rows, { key, selected: true, firstName: '', lastName: '', privateEmail: '', email: '', edited: false }]);
  };
  const removePerson = (key: number) => setManual((rows) => rows.filter((r) => r.key !== key));
  /** Someone added by hand who applied after all: take the application instead of a second account. */
  const takeApplication = (m: ManualDraft, p: AdmittedPerson) => {
    removePerson(m.key);
    setDrafts((all) => (all[p.application] ? { ...all, [p.application]: { ...all[p.application], selected: true } } : all));
  };
  const inProgress = (data?.members ?? []).filter((m) => !m.complete);
  const completed = (data?.members ?? []).filter((m) => m.complete);

  const exportAccounts = async (
    body: { create?: unknown[]; manual?: unknown[]; reissue?: number[] },
    what: string,
    manualKeys: number[] = [],
  ) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setProblems([]);
    setSentManual(manualKeys);
    try {
      const res = await fetch(`${apiRoute}/onboarding/admin/accounts`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const answer = (await res.json().catch(() => null)) as { error?: string; problems?: Problem[] } | null;
        setError(answer?.error ?? `Failed (${res.status}).`);
        setProblems(answer?.problems ?? []);
        if (res.status === 409) await load();
        return;
      }
      await saveDownload(res);
      setNotice(
        `${what} The download holds the Google CSV and the password sheets. Upload the CSV in Google Admin (Directory, Users, "Bulk update users"), print the sheets, then delete the download: the passwords are not kept anywhere else. Lost it? Export the accounts again below; that sets new passwords, and the new CSV has to be uploaded again.`,
      );
      setReissue(new Set());
      // Created now: they show under "In onboarding" after the reload.
      setManual((rows) => rows.filter((r) => !manualKeys.includes(r.key)));
      await load();
    } catch (err) {
      setError(
        `The download did not arrive (${(err as Error).message}). If the accounts now show under "In onboarding", export them again there.`,
      );
      await load();
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    exportAccounts(
      {
        create: selected.map((p) => ({
          application: p.application,
          email: drafts[p.application].email.trim(),
          firstName: drafts[p.application].firstName.trim(),
          lastName: drafts[p.application].lastName.trim(),
        })),
        manual: manualSelected.map((m) => ({
          firstName: m.firstName.trim(),
          lastName: m.lastName.trim(),
          email: emailOf(m).trim(),
          privateEmail: m.privateEmail.trim(),
        })),
      },
      `${plural(selectedCount, 'account', 'accounts')} created.`,
      manualSelected.map((m) => m.key),
    );

  const reexport = () =>
    exportAccounts({ reissue: [...reissue] }, `${plural(reissue.size, 'account', 'accounts')} exported with new passwords.`);

  const patchMember = (id: number, change: (m: OnboardingMember) => OnboardingMember) =>
    setData((d) => (d ? { ...d, members: d.members.map((m) => (m.id === id ? change(m) : m)) } : d));

  const problemFor = (p: AdmittedPerson) => problems.find((x) => x.application === p.application)?.message;
  const manualProblemFor = (m: ManualDraft) =>
    problems.find((x) => x.manual !== undefined && sentManual[x.manual] === m.key)?.message;
  const manualName = (index: number) => {
    const m = manual.find((r) => r.key === sentManual[index]);
    return m ? fullName({ ...m, email: emailOf(m) }) || 'Added by hand' : 'Added by hand';
  };
  const selectAll = (on: boolean) => {
    setDrafts((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, { ...v, selected: on }])));
    setManual((rows) => rows.map((r) => ({ ...r, selected: on })));
  };

  return (
    <div className="ob">
      <SetStepNav nav={[{ label: 'Onboarding' }]} />
      <PageHeader
        title="Onboarding"
        actions={[
          <Button key="settings" buttonStyle="pill" size="small" margin={false} el="link" to={`${adminRoute}/globals/onboarding`}>
            Settings
          </Button>,
        ]}
        after={
          <ViewDescription
            description={
              'New members from "admitted" in the review to done: create their Google accounts, follow their onboarding, tick the board\'s to-dos and publish their profile. What members go through is set in Settings.'
            }
          />
        }
      />

      {error && (
        <Banner type="error">
          {error}
          {problems.length > 0 && (
            <ul className="ob-problems">
              {problems.map((p, i) => (
                <li key={i}>
                  {p.application
                    ? `${admittedName(data, p.application)}: `
                    : p.manual !== undefined
                      ? `${manualName(p.manual)}: `
                      : p.user
                      ? `${data?.members.find((m) => m.id === p.user)?.email ?? `Account ${p.user}`}: `
                      : ''}
                  {p.message}
                </li>
              ))}
            </ul>
          )}
        </Banner>
      )}
      {notice && <Banner type="success">{notice}</Banner>}
      {!data && !error && <p className="ob-empty">Loading…</p>}

      {data && (
        <>
          {/* ---- admitted, no account yet ------------------------------------ */}
          <section className="ob-section" aria-labelledby="ob-admitted">
            <div className="ob-section__head">
              <h2 id="ob-admitted">Admitted ({rowCount})</h2>
              <div className="ob-actions">
                <Button buttonStyle="secondary" size="small" margin={false} disabled={busy} onClick={addPerson}>
                  Add person
                </Button>
                <Button
                  buttonStyle="primary"
                  size="small"
                  margin={false}
                  disabled={busy || selectedCount === 0}
                  onClick={() => openModal(CREATE_MODAL)}
                >
                  {busy ? 'Working…' : `Create ${plural(selectedCount, 'account', 'accounts')} and download`}
                </Button>
              </div>
            </div>
            <p className="ob-hint">
              Applications set to "Admitted" in the review that have no account yet. Check the names and the
              association address (@{data.domain}), select people and create their accounts. Google org unit:{' '}
              <code>{data.orgUnitPath}</code>. "Add person" is for people who never applied here.
            </p>
            {manual.length > 0 && (
              <p className="ob-hint">People added by hand are kept on this page only: reloading it before creating their accounts drops them.</p>
            )}
            {rowCount === 0 ? (
              <p className="ob-empty">Nobody is waiting for an account.</p>
            ) : (
              <div className="ob-table" role="table" aria-label="Admitted applications">
                <div className="ob-table__row ob-table__row--head" role="row">
                  <span role="columnheader">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={selectedCount === rowCount}
                      onChange={(e) => selectAll(e.target.checked)}
                    />
                  </span>
                  <span role="columnheader">First name</span>
                  <span role="columnheader">Last name</span>
                  <span role="columnheader">Association address</span>
                  <span role="columnheader">Applied with</span>
                </div>
                {data.admitted.map((p) => {
                  const d = drafts[p.application];
                  if (!d) return null;
                  const set = (patch: Partial<Draft>) =>
                    setDrafts((all) => ({ ...all, [p.application]: { ...all[p.application], ...patch } }));
                  const problem = problemFor(p);
                  return (
                    <div key={p.application} className={`ob-table__row${problem ? ' ob-table__row--problem' : ''}`} role="row">
                      <span role="cell">
                        <input
                          type="checkbox"
                          aria-label={`Select ${fullName({ ...d, email: '' })}`}
                          checked={d.selected}
                          onChange={(e) => set({ selected: e.target.checked })}
                        />
                      </span>
                      <span role="cell">
                        <input className="ob-input" value={d.firstName} aria-label="First name" onChange={(e) => set({ firstName: e.target.value })} />
                      </span>
                      <span role="cell">
                        <input className="ob-input" value={d.lastName} aria-label="Last name" onChange={(e) => set({ lastName: e.target.value })} />
                      </span>
                      <span role="cell">
                        <input
                          className="ob-input ob-input--mono"
                          value={d.email}
                          aria-label="Association address"
                          placeholder={`first.last@${data.domain}`}
                          onChange={(e) => set({ email: e.target.value })}
                        />
                        {problem && <span className="ob-hint ob-hint--error">{problem}</span>}
                      </span>
                      <span role="cell" className="ob-muted">
                        <a href={`${adminRoute}/collections/form-submissions/${p.application}`}>{p.privateEmail || 'No address'}</a>
                        <br />
                        {day(p.appliedAt)}
                      </span>
                    </div>
                  );
                })}
                {manual.map((m) => {
                  const problem = manualProblemFor(m);
                  const application = appliedToo(m);
                  return (
                    <div key={`manual-${m.key}`} className={`ob-table__row${problem ? ' ob-table__row--problem' : ''}`} role="row">
                      <span role="cell">
                        <input
                          type="checkbox"
                          aria-label={`Select ${fullName({ ...m, email: '' }) || 'person added by hand'}`}
                          checked={m.selected}
                          onChange={(e) => setManualRow(m.key, { selected: e.target.checked })}
                        />
                      </span>
                      <span role="cell">
                        <input
                          className="ob-input"
                          value={m.firstName}
                          aria-label="First name"
                          ref={(el) => {
                            if (el && focusKey.current === m.key) {
                              focusKey.current = null;
                              el.focus();
                            }
                          }}
                          onChange={(e) => setManualRow(m.key, { firstName: e.target.value })}
                        />
                      </span>
                      <span role="cell">
                        <input
                          className="ob-input"
                          value={m.lastName}
                          aria-label="Last name"
                          onChange={(e) => setManualRow(m.key, { lastName: e.target.value })}
                        />
                      </span>
                      <span role="cell">
                        <input
                          className="ob-input ob-input--mono"
                          value={emailOf(m)}
                          aria-label="Association address"
                          placeholder={`first.last@${data.domain}`}
                          onChange={(e) => setManualRow(m.key, { email: e.target.value, edited: true })}
                        />
                        {problem && <span className="ob-hint ob-hint--error">{problem}</span>}
                      </span>
                      <span role="cell" className="ob-muted">
                        <input
                          className="ob-input"
                          type="email"
                          value={m.privateEmail}
                          aria-label="Private address (optional)"
                          placeholder="Private address (optional)"
                          onChange={(e) => setManualRow(m.key, { privateEmail: e.target.value })}
                        />
                        {application && (
                          <span className="ob-hint ob-hint--error">
                            Applied too ({day(application.appliedAt)}).{' '}
                            <button type="button" className="ob-linkbtn" onClick={() => takeApplication(m, application)}>
                              Use the application instead
                            </button>
                          </span>
                        )}
                        <span className="ob-manual">
                          Added by hand{' '}
                          <button type="button" className="ob-linkbtn" onClick={() => removePerson(m.key)}>
                            Remove
                          </button>
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ---- in onboarding ----------------------------------------------- */}
          <section className="ob-section" aria-labelledby="ob-progress">
            <div className="ob-section__head">
              <h2 id="ob-progress">In onboarding ({inProgress.length})</h2>
              <Button
                buttonStyle="secondary"
                size="small"
                margin={false}
                disabled={busy || reissue.size === 0}
                onClick={() => openModal(REISSUE_MODAL)}
              >
                {`Export ${plural(reissue.size, 'account', 'accounts')} again`}
              </Button>
            </div>
            <p className="ob-hint">
              Download lost? Tick "Export again" on the accounts and download a new file. It sets new passwords: upload
              its CSV in Google Admin again, or the new sheets will not work.
            </p>
            {inProgress.length === 0 ? (
              <p className="ob-empty">Nobody is in the middle of their onboarding.</p>
            ) : (
              <div className="ob-cards">
                {inProgress.map((m) => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    data={data}
                    apiRoute={apiRoute}
                    adminRoute={adminRoute}
                    reissue={reissue.has(m.id)}
                    onReissue={(on) =>
                      setReissue((s) => {
                        const next = new Set(s);
                        if (on) next.add(m.id);
                        else next.delete(m.id);
                        return next;
                      })
                    }
                    onChange={(change) => patchMember(m.id, change)}
                    onReload={load}
                    onError={setError}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ---- completed ---------------------------------------------------- */}
          <section className="ob-section" aria-labelledby="ob-done">
            <div className="ob-section__head">
              <h2 id="ob-done">Completed ({completed.length})</h2>
            </div>
            {completed.length === 0 ? (
              <p className="ob-empty">Nobody has finished yet.</p>
            ) : (
              <div className="ob-cards">
                {completed.map((m) => (
                  <details key={m.id} className="ob-done">
                    <summary>
                      <strong>{fullName(m)}</strong> <span className="ob-muted">{m.email}</span>
                    </summary>
                    <MemberCard
                      member={m}
                      data={data}
                      apiRoute={apiRoute}
                      adminRoute={adminRoute}
                      reissue={reissue.has(m.id)}
                      onReissue={(on) =>
                        setReissue((s) => {
                          const next = new Set(s);
                          if (on) next.add(m.id);
                          else next.delete(m.id);
                          return next;
                        })
                      }
                      onChange={(change) => patchMember(m.id, change)}
                      onReload={load}
                      onError={setError}
                    />
                  </details>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ConfirmationModal
        modalSlug={CREATE_MODAL}
        heading={`Create ${plural(selectedCount, 'account', 'accounts')}?`}
        body={
          <div className="ob-confirm">
            <ul>
              {selected.map((p) => (
                <li key={p.application}>
                  {fullName({ ...drafts[p.application], email: '' })}: <code>{drafts[p.application].email}</code>
                </li>
              ))}
              {manualSelected.map((m) => (
                <li key={`manual-${m.key}`}>
                  {fullName({ ...m, email: '' })} (added by hand): <code>{emailOf(m)}</code>
                </li>
              ))}
            </ul>
            <p>
              This creates the member accounts here and downloads, once, a ZIP with the Google CSV and the password
              sheets. The passwords are in that download only.
            </p>
          </div>
        }
        confirmLabel="Create and download"
        confirmingLabel="Creating…"
        onConfirm={create}
      />
      <ConfirmationModal
        modalSlug={REISSUE_MODAL}
        heading={`Export ${plural(reissue.size, 'account', 'accounts')} with new passwords?`}
        body={
          <div className="ob-confirm">
            <p>
              The new download has new passwords. They only work once its CSV is uploaded in Google Admin again; until
              then the old passwords stay in force. Sheets printed before are no longer valid after the upload.
            </p>
          </div>
        }
        confirmLabel="Export with new passwords"
        confirmingLabel="Exporting…"
        onConfirm={reexport}
      />
    </div>
  );
}

// ---- one member ---------------------------------------------------------------

function MemberCard({
  member: m,
  data,
  apiRoute,
  adminRoute,
  reissue,
  onReissue,
  onChange,
  onReload,
  onError,
}: {
  member: OnboardingMember;
  data: OnboardingOverview;
  apiRoute: string;
  adminRoute: string;
  reissue: boolean;
  onReissue: (on: boolean) => void;
  onChange: (change: (m: OnboardingMember) => OnboardingMember) => void;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(m.profile?.title ?? '');
  const [projects, setProjects] = useState<number[]>(m.profile?.projects ?? []);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    setTitle(m.profile?.title ?? '');
    setProjects(m.profile?.projects ?? []);
  }, [m.profile?.title, m.profile?.projects]);

  const post = async (path: string, body: unknown) => {
    const res = await fetch(`${apiRoute}/onboarding/admin/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const answer = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) throw new Error(String(answer?.error ?? `${res.status} ${res.statusText}`));
    return answer;
  };

  const toggleBoard = async (item: string, done: boolean) => {
    const before = m.boardTodos;
    onChange((x) => ({ ...x, boardTodos: x.boardTodos.map((t) => (t.id === item ? { ...t, done } : t)) }));
    try {
      const a = (await post('check', { user: m.id, item, done })) as { at: string; by: string };
      onChange((x) => ({ ...x, boardTodos: x.boardTodos.map((t) => (t.id === item ? { ...t, done, at: a.at, by: a.by } : t)) }));
    } catch (err) {
      onChange((x) => ({ ...x, boardTodos: before }));
      onError(`Could not save the to-do (${(err as Error).message}).`);
    }
  };

  const saveProfile = async (change: { title?: string; projects?: number[]; published?: boolean }) => {
    setSaving(true);
    setSavedNote(null);
    try {
      const a = (await post('profile', { user: m.id, ...change })) as { profile: OnboardingMember['profile'] };
      onChange((x) => ({ ...x, profile: a.profile }));
      setSavedNote('Saved');
    } catch (err) {
      onError(`Could not save the profile (${(err as Error).message}).`);
    } finally {
      setSaving(false);
    }
  };

  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  // Webhooks can get lost: read this member's documents from DocuSeal again.
  const resync = async () => {
    setSyncing(true);
    setSyncNote(null);
    try {
      const a = (await post('documents/resync', { user: m.id })) as { results: { item: string; error?: string }[] };
      const errors = a.results.filter((r) => r.error);
      await onReload();
      setSyncNote(
        errors.length
          ? `DocuSeal: ${errors.map((r) => `${m.documents.find((d) => d.id === r.item)?.title ?? r.item}: ${r.error}`).join('; ')}`
          : `Up to date with DocuSeal (${when.format(new Date())})`,
      );
    } catch (err) {
      onError(`Could not read the documents from DocuSeal (${(err as Error).message}).`);
    } finally {
      setSyncing(false);
    }
  };
  const docuseal = data.docuseal;
  const canResync = docuseal.configured && m.documents.some((d) => d.submissionId !== null && d.status !== 'completed');

  const memberDone = m.memberTodos.filter((t) => t.done).length;
  const profileDirty =
    m.profile !== null &&
    (title.trim() !== m.profile.title || [...projects].sort().join() !== [...m.profile.projects].sort().join());

  return (
    <article className="ob-card" aria-label={fullName(m)}>
      <header className="ob-card__head">
        <div>
          <h3>
            <a href={`${adminRoute}/collections/users/${m.id}`}>{fullName(m)}</a>
          </h3>
          <span className="ob-muted ob-mono">{m.email}</span>
          {m.role !== 'member' && <span className="ob-badge">{m.role}</span>}
        </div>
        <label className="ob-reissue">
          <input type="checkbox" checked={reissue} onChange={(e) => onReissue(e.target.checked)} /> Export again
        </label>
      </header>

      <dl className="ob-status">
        <div>
          <dt>Google account</dt>
          <dd>{m.accountExportedAt ? `Exported ${day(m.accountExportedAt)}` : 'Not exported from here'}</dd>
        </div>
        <div>
          <dt>Signed in</dt>
          <dd className={m.signedInAt ? 'ob-yes' : 'ob-no'}>{m.signedInAt ? day(m.signedInAt) : 'Not yet'}</dd>
        </div>
        <div>
          <dt>Form</dt>
          <dd className={m.formSubmittedAt ? 'ob-yes' : 'ob-no'}>
            {!data.formConfigured ? 'No form set' : m.formSubmittedAt ? `Sent ${day(m.formSubmittedAt)}` : 'Not sent'}
          </dd>
        </div>
        <div>
          <dt>Own to-dos</dt>
          <dd className={memberDone === m.memberTodos.length ? 'ob-yes' : 'ob-no'}>
            {m.memberTodos.length === 0 ? 'None set' : `${memberDone} of ${m.memberTodos.length}`}
          </dd>
        </div>
        <div>
          <dt>Documents</dt>
          <dd>
            {m.documents.length === 0
              ? 'None set'
              : m.documents.map((d) => (
                  <span key={d.id} className={`ob-doc ${d.status === 'completed' ? 'ob-yes' : 'ob-no'}`}>
                    {d.title}: <strong>{DOCUMENT_STATUS[d.status] ?? d.status}</strong>
                    {d.status === 'completed' && d.completedAt
                      ? ` ${day(d.completedAt)}`
                      : d.startedAt
                        ? ` (since ${day(d.startedAt)})`
                        : ''}
                    {docuseal.url && d.submissionId !== null && (
                      <>
                        {' '}
                        <a href={`${docuseal.url}/submissions/${d.submissionId}`} target="_blank" rel="noopener noreferrer">
                          DocuSeal ↗
                        </a>
                      </>
                    )}
                  </span>
                ))}
            {m.documents.length > 0 && !docuseal.configured && <span className="ob-doc ob-muted">DocuSeal is not configured</span>}
            {canResync && (
              <button type="button" className="ob-linkbtn" disabled={syncing} onClick={() => void resync()}>
                {syncing ? 'Reading from DocuSeal…' : 'Refresh from DocuSeal'}
              </button>
            )}
            {syncNote && <span className="ob-doc ob-hint">{syncNote}</span>}
          </dd>
        </div>
      </dl>

      {m.memberTodos.some((t) => !t.done) && (
        <p className="ob-hint">Open: {m.memberTodos.filter((t) => !t.done).map((t) => t.text).join('; ')}</p>
      )}

      <div className="ob-card__body">
        <section aria-label="Board to-dos">
          <h4>Board to-dos</h4>
          {m.boardTodos.length === 0 ? (
            <p className="ob-empty">None set (Settings, "To-dos for the board").</p>
          ) : (
            m.boardTodos.map((t) => (
              <div key={t.id} className="ob-todo">
                <CheckboxInput label={t.text} checked={t.done} onToggle={() => void toggleBoard(t.id, !t.done)} />
                {t.done && t.at && (
                  <span className="ob-hint">
                    {day(t.at)}
                    {t.by ? `, ${t.by}` : ''}
                  </span>
                )}
              </div>
            ))
          )}
        </section>

        <section aria-label="Profile">
          <h4>Profile</h4>
          {!m.profile ? (
            <p className="ob-empty">No profile yet. It is made when the member sends the onboarding form.</p>
          ) : (
            <>
              <label className="ob-label">
                Title
                <input className="ob-input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <fieldset className="ob-projects">
                <legend className="ob-label">Projects</legend>
                {data.projects.length === 0 && <span className="ob-empty">No projects yet.</span>}
                {data.projects.map((p) => (
                  <label key={p.id} className="ob-project">
                    <input
                      type="checkbox"
                      checked={projects.includes(p.id)}
                      onChange={(e) =>
                        setProjects((list) => (e.target.checked ? [...list, p.id] : list.filter((id) => id !== p.id)))
                      }
                    />{' '}
                    {p.title}
                  </label>
                ))}
              </fieldset>
              <div className="ob-actions">
                <Button
                  buttonStyle="secondary"
                  size="small"
                  margin={false}
                  disabled={saving || !profileDirty || !title.trim()}
                  onClick={() => void saveProfile({ title: title.trim(), projects })}
                >
                  Save title and projects
                </Button>
                <Button
                  buttonStyle={m.profile.published ? 'secondary' : 'primary'}
                  size="small"
                  margin={false}
                  disabled={saving}
                  onClick={() => void saveProfile({ published: !m.profile!.published })}
                >
                  {m.profile.published ? 'Unpublish profile' : 'Publish profile'}
                </Button>
                <span className="ob-hint">
                  {m.profile.published ? 'On the Team page.' : 'Not on the Team page yet.'}{' '}
                  <a href={`${adminRoute}/collections/team/${m.profile.id}`}>Open in Team</a>
                  {savedNote ? ` · ${savedNote}` : ''}
                </span>
              </div>
            </>
          )}
        </section>
      </div>
    </article>
  );
}
