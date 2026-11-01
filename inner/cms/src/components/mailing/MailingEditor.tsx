'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Banner,
  Button,
  CheckboxInput,
  ConfirmationModal,
  SelectInput,
  SetStepNav,
  TextareaInput,
  TextInput,
  useModal,
  ViewDescription,
} from '@payloadcms/ui';
import { manageUrl, SAMPLE_TOKEN } from '../../lib/manage/link';
import {
  describeFilter,
  emptyGroup,
  mailFor,
  MAIL_LANGS,
  PLACEHOLDER_HELP,
  SOURCES,
  type FilterDef,
  type FilterValue,
  type FlagFilter,
  type MailingConfig,
  type MailingGroup,
  type MailLang,
  type RangeFilter,
} from '../../lib/mailing/model';
import { renderMail, type MailSite } from '../../lib/mailing/render';
import { countsOf, type PreviousMail, type Resolution, type ResolvedPerson } from '../../lib/mailing/resolve';
import type { MailingRow, RecipientRow, SendRow } from '../../lib/mailing/store';
import { PageHeader } from '../shared/PageHeader';
import { when } from './format';
import './mailing.css';

/**
 * One mailing (/admin/mailing?id=…): its groups – who is in each and what
 * they get – on the left; on the right the check (who gets which mail right
 * now, who fits no group, who had it already), the preview, a test send and
 * the send itself; below, every mail it sent.
 *
 * Mailing-wide: an optional header image (from Media or any https address),
 * shown under the logo in every group's mail.
 *
 * Edits save as you go. The check runs on the server against the real data
 * whenever the groups change (endpoints/mailing.ts `/resolve`); the send
 * button only works once the saved mailing and the check agree and nothing is
 * in the way, and the server checks the confirmed numbers again before it
 * sends anything.
 */

type Props = { id: number; apiRoute: string; adminRoute: string; site: MailSite };
type Loaded = { mailing: MailingRow; sends: SendRow[]; recipients: RecipientRow[] };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type SendResult = { sent: number; failed: number; errors: string[]; transport: string };
type MediaDoc = { id: number; url?: string | null; filename?: string | null; mimeType?: string | null; sizes?: { card?: { url?: string | null } | null } | null };

// Media docs carry site-relative URLs (/api/media/file/…); mail clients need
// absolute ones. The admin runs on the public domain, so its origin is right.
const toAbsolute = (u: string): string => {
  try {
    return new URL(u, window.location.origin).href;
  } catch {
    return u;
  }
};

const LANG_LABEL: Record<MailLang, string> = { en: 'English', de: 'German' };
const SEND_MODAL = 'mailing-send';
const DELETE_MODAL = 'mailing-delete';
const OWN_DOMAIN = /@codingforchange\.com$/i;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function MailingEditor({ id, apiRoute, adminRoute, site }: Props) {
  const router = useRouter();
  const { openModal } = useModal();

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [config, setConfig] = useState<MailingConfig | null>(null);
  const [savedJson, setSavedJson] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [resolvedJson, setResolvedJson] = useState('');
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkKey, setCheckKey] = useState(0);

  const [langTab, setLangTab] = useState<Record<string, MailLang>>({});
  const [previewGroup, setPreviewGroup] = useState<string | null>(null);
  const [previewLang, setPreviewLang] = useState<MailLang>('de');
  const [testTo, setTestTo] = useState('');
  const [testState, setTestState] = useState<{ kind: 'idle' | 'sending' | 'done' | 'error'; text?: string }>({ kind: 'idle' });
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [historyQuery, setHistoryQuery] = useState('');
  const [liveFilters, setLiveFilters] = useState<Record<string, FilterDef[]> | null>(null);
  const [media, setMedia] = useState<MediaDoc[] | null>(null);
  const [accent, setAccent] = useState<{ url: string; accent: { hue: number; sat: number } | null } | null>(null);

  const source = loaded?.mailing.source ?? 'applications';
  const def = SOURCES[source];
  /** The source's filters with the options from the data (the TechTour evenings) once loaded. */
  const filters = liveFilters?.[source] ?? def.filters;
  const draftJson = useMemo(() => JSON.stringify({ title, config }), [title, config]);
  const configJson = useMemo(() => JSON.stringify(config), [config]);
  const dirty = config !== null && draftJson !== savedJson;

  // ---- load ------------------------------------------------------------------
  const fetchMailing = useCallback(async (): Promise<Loaded> => {
    const res = await fetch(`${apiRoute}/mailing/mailings/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error(res.status === 404 ? 'not found' : `${res.status} ${res.statusText}`);
    return (await res.json()) as Loaded;
  }, [apiRoute, id]);

  useEffect(() => {
    fetchMailing()
      .then((data) => {
        setLoaded(data);
        setTitle(data.mailing.title);
        setConfig(data.mailing.config);
        setSavedJson(JSON.stringify({ title: data.mailing.title, config: data.mailing.config }));
        setPreviewGroup(data.mailing.config.groups[0]?.id ?? null);
      })
      .catch((err: Error) => setLoadError(`Could not load this mailing (${err.message}).`));
  }, [fetchMailing]);

  useEffect(() => {
    fetch(`${apiRoute}/mailing/sources`, { credentials: 'include' })
      .then(async (res) => (res.ok ? setLiveFilters(((await res.json()) as { filters: Record<string, FilterDef[]> }).filters) : undefined))
      .catch(() => undefined);
    // Images from Media for the header-image picker; the card rendition (800px) suits a mail.
    fetch(`${apiRoute}/media?limit=100&sort=-createdAt&depth=0`, { credentials: 'include' })
      .then(async (res) => (res.ok ? ((await res.json()) as { docs?: MediaDoc[] }).docs ?? [] : []))
      .then((docs) => setMedia(docs.filter((d) => (d.mimeType ?? '').startsWith('image/'))))
      .catch(() => setMedia([]));
  }, [apiRoute]);

  // The band behind the header image takes the artwork's colour – asked of the server, as the send does.
  const headerImageUrl = config?.headerImageUrl ?? '';
  useEffect(() => {
    if (!/^https?:\/\/\S+$/i.test(headerImageUrl) || accent?.url === headerImageUrl) return;
    const timer = setTimeout(() => {
      fetch(`${apiRoute}/mailing/accent`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: headerImageUrl }),
      })
        .then(async (res) => (res.ok ? ((await res.json()) as { accent: { hue: number; sat: number } | null }).accent : null))
        .then((a) => setAccent({ url: headerImageUrl, accent: a }))
        .catch(() => setAccent({ url: headerImageUrl, accent: null }));
    }, 400);
    return () => clearTimeout(timer);
  }, [headerImageUrl, accent, apiRoute]);

  /** Sends and recipients only – the groups being edited stay as they are. */
  const reloadHistory = useCallback(async () => {
    const data = await fetchMailing();
    setLoaded((prev) => (prev ? { ...prev, sends: data.sends, recipients: data.recipients } : data));
  }, [fetchMailing]);

  // ---- save as you go -----------------------------------------------------------
  useEffect(() => {
    if (!dirty || !config) return;
    const json = draftJson;
    const timer = setTimeout(async () => {
      setSaveState('saving');
      try {
        const res = await fetch(`${apiRoute}/mailing/mailings/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: json,
        });
        if (!res.ok) throw new Error(String(res.status));
        setSavedJson(json);
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [dirty, draftJson, config, apiRoute, id]);

  // ---- the check ------------------------------------------------------------------
  useEffect(() => {
    if (!config) return;
    const json = configJson;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${apiRoute}/mailing/resolve`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source, config: JSON.parse(json), mailing: id }),
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        setResolution((await res.json()) as Resolution);
        setResolvedJson(json);
        setCheckError(null);
      } catch (err) {
        setCheckError(`Could not check the recipients (${(err as Error).message}).`);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [configJson, config, source, apiRoute, id, checkKey]);

  // ---- editing ------------------------------------------------------------------------
  const setGroups = (fn: (groups: MailingGroup[]) => MailingGroup[]) =>
    setConfig((c) => (c ? { ...c, groups: fn(c.groups) } : c));
  const updateGroup = (gid: string, fn: (g: MailingGroup) => MailingGroup) =>
    setGroups((groups) => groups.map((g) => (g.id === gid ? fn(g) : g)));
  const setFilter = (gid: string, key: string, value: FilterValue | undefined) =>
    updateGroup(gid, (g) => {
      const filter = { ...g.filter };
      if (value === undefined) delete filter[key];
      else filter[key] = value;
      return { ...g, filter };
    });
  const setMail = (gid: string, lang: MailLang, field: 'subject' | 'message' | 'ctaLabel', value: string) =>
    updateGroup(gid, (g) => ({ ...g, mail: { ...g.mail, [lang]: { ...g.mail[lang], [field]: value } } }));
  const move = (gid: string, by: -1 | 1) =>
    setGroups((groups) => {
      const i = groups.findIndex((g) => g.id === gid);
      const j = i + by;
      if (i < 0 || j < 0 || j >= groups.length) return groups;
      const next = [...groups];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  // ---- sending -------------------------------------------------------------------------
  const checked = resolution !== null && resolvedJson === configJson;
  const canSend = checked && !dirty && saveState !== 'saving' && resolution.problems.length === 0 && resolution.toSend > 0;

  const send = async () => {
    if (!resolution) return;
    setSendError(null);
    setSendResult(null);
    try {
      const res = await fetch(`${apiRoute}/mailing/mailings/${id}/send`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected: countsOf(resolution) }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<SendResult> & { error?: string; resolution?: Resolution };
      if (!res.ok) {
        setSendError(data.error ?? `The send failed (${res.status}).`);
        if (data.resolution) {
          setResolution(data.resolution);
          setResolvedJson(configJson);
        }
        return;
      }
      setSendResult({ sent: data.sent ?? 0, failed: data.failed ?? 0, errors: data.errors ?? [], transport: data.transport ?? '' });
    } catch (err) {
      setSendError(`The send failed (${(err as Error).message}). Reload before you try again – some mails may have gone out.`);
    } finally {
      await reloadHistory().catch(() => undefined);
      setCheckKey((k) => k + 1);
    }
  };

  const sendTest = async (group: MailingGroup, lang: MailLang, sampleName: string) => {
    setTestState({ kind: 'sending' });
    try {
      const res = await fetch(`${apiRoute}/mailing/test`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, config, group: group.id, lang, to: testTo, sampleName }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; sent?: number; failed?: number; errors?: string[]; to?: string[] };
      if (!res.ok) throw new Error(data.error ?? String(res.status));
      if (data.failed) throw new Error(data.errors?.[0] ?? 'The test did not go out.');
      setTestState({ kind: 'done', text: `Test sent to ${data.to?.join(', ')}.` });
    } catch (err) {
      setTestState({ kind: 'error', text: (err as Error).message });
    }
  };

  const duplicate = async () => {
    if (!config) return;
    const res = await fetch(`${apiRoute}/mailing/mailings`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `Copy of ${title}`, source, config }),
    });
    if (res.ok) router.push(`${adminRoute}/mailing?id=${((await res.json()) as { id: number }).id}`);
  };

  const remove = async () => {
    const res = await fetch(`${apiRoute}/mailing/mailings/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) router.push(`${adminRoute}/mailing`);
    else setSendError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not delete it.');
  };

  // ---- render ---------------------------------------------------------------------------
  if (loadError) {
    return (
      <div className="ml">
        <SetStepNav nav={[{ label: 'Mailing', url: `${adminRoute}/mailing` }]} />
        <Banner type="error">{loadError}</Banner>
      </div>
    );
  }
  if (!loaded || !config) return <p className="ml-empty">Loading…</p>;

  const sentBefore = loaded.sends.length > 0;
  const groupOf = (gid: string | null) => config.groups.find((g) => g.id === gid) ?? config.groups[0];
  const shownGroup = groupOf(previewGroup);
  const resolvedGroup = resolution?.groups.find((g) => g.id === shownGroup?.id);
  const sample: ResolvedPerson | undefined =
    resolvedGroup?.people.find((p) => p.lang === previewLang) ?? resolvedGroup?.people[0];
  const preview = shownGroup
    ? renderMail(
        source,
        shownGroup,
        { firstName: sample?.firstName || 'Alex', lang: previewLang, manageLink: manageUrl(site.siteOrigin, SAMPLE_TOKEN) },
        site,
        {
          headerImageUrl: config.headerImageUrl || undefined,
          heroAccent: accent?.url === config.headerImageUrl ? accent.accent : null,
        },
      )
    : null;
  const pickedMedia = media?.find((m) => {
    const u = m.sizes?.card?.url || m.url;
    return u && toAbsolute(u) === config.headerImageUrl;
  });
  const ownDomainTest = testTo.split(/[\s,;]+/).some((a) => OWN_DOMAIN.test(a.trim()));
  const recipients = loaded.recipients.filter((r) => {
    const q = historyQuery.trim().toLowerCase();
    return !q || r.email.includes(q) || (r.name ?? '').toLowerCase().includes(q) || r.groupLabel.toLowerCase().includes(q);
  });

  return (
    <div className="ml">
      <SetStepNav nav={[{ label: 'Mailing', url: `${adminRoute}/mailing` }, { label: title || 'Mailing' }]} />
      <PageHeader
        title={title || 'Mailing'}
        titleActions={[
          <Button key="dup" buttonStyle="pill" size="small" margin={false} onClick={duplicate}>
            Duplicate
          </Button>,
          ...(sentBefore
            ? []
            : [
                <Button key="del" buttonStyle="pill" size="small" margin={false} onClick={() => openModal(DELETE_MODAL)}>
                  Delete
                </Button>,
              ]),
        ]}
        actions={[
          <span key="save" className={`ml-save ml-save--${saveState}`} aria-live="polite">
            {saveState === 'saving' || dirty ? 'Saving…' : saveState === 'error' ? 'Not saved – check your connection' : 'Saved'}
          </span>,
        ]}
        after={
          <ViewDescription
            description={`To: ${def.label}${def.perEntry ? ' (one mail per registration)' : ''}. Each person gets the mail of the first group they fit – put the most specific group first.`}
          />
        }
      />

      <div className="ml-editor">
        {/* ---- groups ------------------------------------------------------------ */}
        <div className="ml-groups">
          <TextInput path="title" label="Title (only the team sees it)" value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} />
          <div className="ml-row">
            <SelectInput
              path="header-media"
              name="header-media"
              label="Header image (optional)"
              placeholder={media === null ? 'Loading Media…' : 'Pick an image from Media'}
              options={[
                { label: 'No image', value: 'none' },
                ...(media ?? []).map((m) => ({ label: m.filename || `Image ${m.id}`, value: String(m.id) })),
              ]}
              value={pickedMedia ? String(pickedMedia.id) : config.headerImageUrl ? undefined : 'none'}
              onChange={(o) => {
                const v = (o as { value?: string } | null)?.value;
                const doc = media?.find((m) => String(m.id) === v);
                const u = doc ? doc.sizes?.card?.url || doc.url : '';
                setConfig((c) => (c ? { ...c, headerImageUrl: u ? toAbsolute(u) : '' } : c));
              }}
              isClearable={false}
            />
            <TextInput
              path="header-url"
              label="…or its address"
              placeholder="https://…"
              value={config.headerImageUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig((c) => (c ? { ...c, headerImageUrl: e.target.value.trim() } : c))}
            />
          </div>

          {config.groups.map((g, index) => {
            const lang = langTab[g.id] ?? 'de';
            const mail = g.mail[lang];
            const count = resolution?.groups.find((x) => x.id === g.id)?.people.length;
            return (
              <section key={g.id} className="ml-group" aria-label={g.label || `Group ${index + 1}`}>
                <header className="ml-group__head">
                  <span className="ml-group__num">{index + 1}</span>
                  <input
                    className="ml-group__label"
                    aria-label="Group name"
                    placeholder="Group name"
                    value={g.label}
                    onChange={(e) => updateGroup(g.id, (x) => ({ ...x, label: e.target.value }))}
                  />
                  {count !== undefined && checked && <span className="ml-badge">{plural(count, 'mail', 'mails')}</span>}
                  <div className="ml-group__tools">
                    <Button buttonStyle="pill" size="small" margin={false} disabled={index === 0} onClick={() => move(g.id, -1)} aria-label="Move up">
                      ↑
                    </Button>
                    <Button buttonStyle="pill" size="small" margin={false} disabled={index === config.groups.length - 1} onClick={() => move(g.id, 1)} aria-label="Move down">
                      ↓
                    </Button>
                    <Button
                      buttonStyle="pill"
                      size="small"
                      margin={false}
                      disabled={config.groups.length === 1}
                      onClick={() => setGroups((groups) => groups.filter((x) => x.id !== g.id))}
                    >
                      Remove
                    </Button>
                  </div>
                </header>

                <div className="ml-group__who">
                  <span className="field-label">Who</span>
                  <div className="ml-filters">
                    {filters.map((f) => (
                      <FilterControl key={f.key} def={f} value={g.filter[f.key]} onChange={(v) => setFilter(g.id, f.key, v)} />
                    ))}
                  </div>
                  <p className="ml-hint">In this group: {describeFilter(filters, g.filter)}</p>
                </div>

                <div className="ml-group__mail">
                  <div className="ml-tabs" role="group" aria-label="Language">
                    {MAIL_LANGS.map((l) => (
                      <Button
                        key={l}
                        buttonStyle="tab"
                        size="small"
                        margin={false}
                        disabled={l === lang}
                        onClick={() => setLangTab((t) => ({ ...t, [g.id]: l }))}
                      >
                        {LANG_LABEL[l]}
                        {!g.mail[l].subject.trim() && !g.mail[l].message.trim() ? ' (empty)' : ''}
                      </Button>
                    ))}
                  </div>
                  <TextInput
                    path={`subject-${g.id}-${lang}`}
                    label="Subject"
                    value={mail.subject}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMail(g.id, lang, 'subject', e.target.value)}
                  />
                  <TextareaInput
                    path={`message-${g.id}-${lang}`}
                    label="Text"
                    rows={10}
                    value={mail.message}
                    onChange={(e) => setMail(g.id, lang, 'message', e.target.value)}
                  />
                  <div className="ml-row">
                    <TextInput
                      path={`cta-${g.id}-${lang}`}
                      label="Button text"
                      placeholder="No button"
                      value={mail.ctaLabel}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMail(g.id, lang, 'ctaLabel', e.target.value)}
                    />
                    <TextInput
                      path={`url-${g.id}`}
                      label="Button link (both languages)"
                      placeholder="https://…"
                      value={g.ctaUrl}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateGroup(g.id, (x) => ({ ...x, ctaUrl: e.target.value }))}
                    />
                  </div>
                  <p className="ml-hint">
                    {def.placeholders.map((ph, i) => (
                      <React.Fragment key={ph}>
                        {i > 0 && ', '}
                        <code>{`{{${ph}}}`}</code> {PLACEHOLDER_HELP[ph]}
                      </React.Fragment>
                    ))}
                    . Blank lines start a new paragraph. A language left empty gets the other one.
                  </p>
                </div>
              </section>
            );
          })}

          <div className="ml-groups__add">
            <Button buttonStyle="pill" size="small" margin={false} onClick={() => setGroups((groups) => [...groups, emptyGroup()])}>
              Add a group
            </Button>
          </div>

          <section className="ml-options" aria-label="Options">
            <CheckboxInput
              label="Reach each person only once – sending again only goes to those who have not had this mailing"
              checked={config.onlyOnce}
              onToggle={() => setConfig((c) => (c ? { ...c, onlyOnce: !c.onlyOnce } : c))}
            />
            <CheckboxInput
              label="Only send when everyone is in a group (nobody left undecided)"
              checked={config.requireAll}
              onToggle={() => setConfig((c) => (c ? { ...c, requireAll: !c.requireAll } : c))}
            />
          </section>
        </div>

        {/* ---- check, preview, test, send --------------------------------------------- */}
        <aside className="ml-side">
          <section className="ml-panel" aria-label="Who gets what">
            <div className="ml-panel__head">
              <span className="field-label">Who gets what</span>
              <span className="ml-hint">{checked ? 'Up to date' : 'Checking…'}</span>
            </div>
            {checkError && <Banner type="error">{checkError}</Banner>}
            {resolution && (
              <>
                {resolution.groups.map((rg) => (
                  <PeopleList key={rg.id} title={rg.label || 'Group'} people={rg.people} note={rg.fallback ? `${rg.fallback} get the other language` : undefined} />
                ))}
                {resolution.unassigned.length > 0 && (
                  <PeopleList
                    title="In no group – get nothing"
                    people={resolution.unassigned}
                    tone={config.requireAll ? 'error' : 'muted'}
                  />
                )}
                {resolution.alreadySent.length > 0 && (
                  <PeopleList
                    title="Had this mailing already – skipped"
                    people={resolution.alreadySent}
                    tone="muted"
                    extra={(p) => {
                      const prev = (p as ResolvedPerson & { previous?: PreviousMail }).previous;
                      return prev ? `${prev.groupLabel}, ${when.format(new Date(prev.at))}` : '';
                    }}
                  />
                )}
                {resolution.invalid > 0 && <p className="ml-hint">{plural(resolution.invalid, 'entry has', 'entries have')} no usable address.</p>}
                {resolution.problems.length > 0 && (
                  // Everyone reached already is where a finished mailing ends up – not an error.
                  <Banner type={resolution.toSend === 0 && resolution.alreadySent.length > 0 && resolution.problems.length === 1 ? 'info' : 'error'}>
                    <ul className="ml-problems">
                      {resolution.problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </Banner>
                )}
              </>
            )}
          </section>

          <section className="ml-panel" aria-label="Preview">
            <div className="ml-panel__head">
              <span className="field-label">Preview</span>
            </div>
            <div className="ml-row ml-row--tight">
              <div className="ml-tabs" role="group" aria-label="Group">
                {config.groups.map((g) => (
                  <Button key={g.id} buttonStyle="tab" size="small" margin={false} disabled={g.id === shownGroup?.id} onClick={() => setPreviewGroup(g.id)}>
                    {g.label || 'Group'}
                  </Button>
                ))}
              </div>
              <div className="ml-tabs" role="group" aria-label="Language">
                {MAIL_LANGS.map((l) => (
                  <Button key={l} buttonStyle="tab" size="small" margin={false} disabled={l === previewLang} onClick={() => setPreviewLang(l)}>
                    {l.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
            {shownGroup && preview ? (
              <>
                <p className="ml-preview__meta">
                  <strong>{preview.subject}</strong>
                  <span>
                    {sample ? `as ${sample.name} would get it` : 'with a sample name'}
                    {shownGroup && mailFor(shownGroup, previewLang)?.fallback ? ` · no ${LANG_LABEL[previewLang]} text, so the ${LANG_LABEL[preview.lang]} one` : ''}
                  </span>
                </p>
                <iframe className="ml-preview" title="Preview" srcDoc={preview.html} sandbox="" />
                <div className="ml-test">
                  <TextInput
                    path="test-to"
                    label="Send a test of this mail to"
                    placeholder="Your own address (default) – up to 10, comma-separated"
                    value={testTo}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestTo(e.target.value)}
                  />
                  {ownDomainTest && (
                    <p className="ml-hint ml-hint--warn">Mail to @codingforchange.com addresses does not arrive at the moment – use a personal address.</p>
                  )}
                  <div className="ml-row ml-row--tight">
                    <Button
                      buttonStyle="secondary"
                      size="small"
                      margin={false}
                      disabled={testState.kind === 'sending'}
                      onClick={() => sendTest(shownGroup, previewLang, sample?.firstName || 'Alex')}
                    >
                      {testState.kind === 'sending' ? 'Sending…' : 'Send test'}
                    </Button>
                    {testState.text && <span className={`ml-hint${testState.kind === 'error' ? ' ml-hint--error' : ''}`}>{testState.text}</span>}
                  </div>
                </div>
              </>
            ) : (
              <p className="ml-hint">Write a subject and a text to see the mail.</p>
            )}
          </section>

          <section className="ml-panel ml-panel--send" aria-label="Send">
            {sendError && <Banner type="error">{sendError}</Banner>}
            {sendResult && (
              <Banner type={sendResult.failed ? 'error' : 'success'}>
                {sendResult.failed
                  ? `${sendResult.sent} sent, ${sendResult.failed} failed (${sendResult.errors[0] ?? 'unknown error'}). The failed ones count as not reached – send again to retry them.`
                  : `${plural(sendResult.sent, 'mail', 'mails')} sent${sendResult.transport === 'console' ? ' to the server console (no RESEND_API_KEY)' : ''}.`}
              </Banner>
            )}
            <Button buttonStyle="primary" margin={false} disabled={!canSend} onClick={() => openModal(SEND_MODAL)}>
              {resolution && checked ? `Send ${plural(resolution.toSend, 'mail', 'mails')}` : 'Send'}
            </Button>
            <p className="ml-hint">
              {dirty || saveState === 'saving'
                ? 'Saving your changes first…'
                : !checked
                  ? 'Checking the recipients…'
                  : resolution?.problems.length
                    ? 'Sort out what is listed above, then send.'
                    : 'You confirm the numbers before anything goes out.'}
            </p>
          </section>
        </aside>
      </div>

      {/* ---- history --------------------------------------------------------------------- */}
      <section className="ml-history" aria-label="Sent">
        <div className="ml-panel__head">
          <span className="field-label">Sent</span>
          {loaded.recipients.length > 0 && (
            <input
              className="ml-search"
              type="search"
              placeholder="Search name, address or group"
              aria-label="Search the sent mails"
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
            />
          )}
        </div>
        {loaded.sends.length === 0 ? (
          <p className="ml-hint">Nothing sent yet.</p>
        ) : (
          <>
            <ul className="ml-sends">
              {loaded.sends.map((s) => (
                <li key={s.id}>
                  {when.format(new Date(s.startedAt))} · {s.sentBy ?? 'unknown'} · {s.sent} sent
                  {s.failed ? ` · ${s.failed} failed` : ''}
                  {!s.finishedAt ? ' · did not finish' : ''}
                </li>
              ))}
            </ul>
            <div className="ml-table" role="table" aria-label="Mails sent">
              <div className="ml-table__row ml-table__row--head ml-table__row--recipients" role="row">
                <span role="columnheader">Name</span>
                <span role="columnheader">Address</span>
                <span role="columnheader">Group</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Time</span>
                <span role="columnheader" />
              </div>
              {recipients.map((r) => (
                <div key={r.id} className="ml-table__row ml-table__row--recipients" role="row">
                  <span role="cell">{r.name || '–'}</span>
                  <span role="cell" className="ml-table__mono">
                    {r.email}
                  </span>
                  <span role="cell">
                    {r.groupLabel} <span className="ml-hint">{r.lang.toUpperCase()}</span>
                  </span>
                  <span role="cell">
                    <span className={`ml-badge ml-badge--${r.status}`} title={r.error ?? undefined}>
                      {r.status === 'sent' ? 'Sent' : r.status === 'failed' ? 'Failed' : 'Unclear'}
                    </span>
                  </span>
                  <span role="cell">{when.format(new Date(r.sentAt ?? r.createdAt))}</span>
                  <span role="cell">
                    <a href={`${apiRoute}/mailing/recipients/${r.id}`} target="_blank" rel="noreferrer">
                      View mail
                    </a>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <ConfirmationModal
        modalSlug={SEND_MODAL}
        heading={resolution ? `Send ${plural(resolution.toSend, 'mail', 'mails')}?` : 'Send?'}
        body={
          resolution && (
            <div className="ml-confirm">
              <ul>
                {resolution.groups
                  .filter((g) => g.people.length)
                  .map((g) => (
                    <li key={g.id}>
                      <strong>{g.people.length}</strong> × {g.label || 'Group'}
                    </li>
                  ))}
              </ul>
              {resolution.unassigned.length > 0 && <p>{plural(resolution.unassigned.length, 'person gets', 'people get')} nothing (in no group).</p>}
              <p>Every mail goes out at once and cannot be called back.</p>
            </div>
          )
        }
        confirmLabel={resolution ? `Send ${plural(resolution.toSend, 'mail', 'mails')}` : 'Send'}
        confirmingLabel="Sending…"
        onConfirm={send}
      />
      <ConfirmationModal
        modalSlug={DELETE_MODAL}
        heading="Delete this mailing?"
        body="It has not been sent, so nothing else is lost."
        confirmLabel="Delete"
        onConfirm={remove}
      />
    </div>
  );
}

/** One filter of a group, drawn by its kind. */
function FilterControl({
  def,
  value,
  onChange,
}: {
  def: FilterDef;
  value: FilterValue | undefined;
  onChange: (value: FilterValue | undefined) => void;
}) {
  if (def.kind === 'choice') {
    const picked = Array.isArray(value) ? value : [];
    return (
      <div className="ml-filter">
        <span className="ml-filter__label">{def.label}</span>
        <div className="ml-segments" role="group" aria-label={def.label}>
          {def.options.map((o) => {
            const on = picked.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                className={`ml-segments__btn${on ? ' is-active' : ''}`}
                aria-pressed={on}
                onClick={() => {
                  const next = on ? picked.filter((v) => v !== o.value) : [...picked, o.value];
                  onChange(next.length ? next : undefined);
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (def.kind === 'range') {
    const range = (value as RangeFilter | undefined) ?? {};
    const options = [
      { label: 'Any', value: 'any' },
      ...Array.from({ length: def.max - def.min + 1 }, (_, i) => ({ label: String(def.min + i), value: String(def.min + i) })),
    ];
    const set = (key: 'min' | 'max', raw: unknown) => {
      const v = (raw as { value?: string } | null)?.value ?? 'any';
      const next = { ...range, [key]: v === 'any' ? null : Number(v) };
      onChange(next.min == null && next.max == null ? undefined : next);
    };
    return (
      <div className="ml-filter">
        <span className="ml-filter__label">{def.label}</span>
        <div className="ml-range">
          <SelectInput path={`${def.key}-min`} name={`${def.key}-min`} options={options} value={range.min == null ? 'any' : String(range.min)} onChange={(o) => set('min', o)} isClearable={false} />
          <span>to</span>
          <SelectInput path={`${def.key}-max`} name={`${def.key}-max`} options={options} value={range.max == null ? 'any' : String(range.max)} onChange={(o) => set('max', o)} isClearable={false} />
        </div>
      </div>
    );
  }
  const flag = (value as FlagFilter | undefined) ?? 'any';
  const choices: { v: FlagFilter; label: string }[] = [
    { v: 'any', label: 'Either' },
    { v: 'yes', label: 'Yes' },
    { v: 'no', label: 'No' },
  ];
  return (
    <div className="ml-filter">
      <span className="ml-filter__label">{def.label}</span>
      <div className="ml-segments" role="group" aria-label={def.label}>
        {choices.map((c) => (
          <button
            key={c.v}
            type="button"
            className={`ml-segments__btn${flag === c.v ? ' is-active' : ''}`}
            aria-pressed={flag === c.v}
            onClick={() => onChange(c.v === 'any' ? undefined : c.v)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A group's people in the check, folded: the count first, the names on demand. */
function PeopleList({
  title,
  people,
  note,
  tone,
  extra,
}: {
  title: string;
  people: ResolvedPerson[];
  note?: string;
  tone?: 'error' | 'muted';
  extra?: (p: ResolvedPerson) => string;
}) {
  return (
    <details className={`ml-people${tone ? ` ml-people--${tone}` : ''}`}>
      <summary>
        <span className="ml-people__title">{title}</span>
        <span className="ml-badge">{people.length}</span>
        {note && <span className="ml-hint">{note}</span>}
      </summary>
      {people.length === 0 ? (
        <p className="ml-hint">Nobody.</p>
      ) : (
        <ul>
          {people.map((p, i) => (
            <li key={`${p.email}-${p.submission ?? p.waitlistSignup ?? i}`}>
              <span className="ml-people__name">{p.name}</span>
              <span className="ml-hint">
                {p.email} · {p.lang.toUpperCase()} · {p.detail}
                {p.entries > 1 ? ` · ${p.entries} entries` : ''}
                {extra ? ` · ${extra(p)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
