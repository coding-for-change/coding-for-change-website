'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banner, ChevronIcon, Pill, Popup, PopupList, SetStepNav, ViewDescription } from '@payloadcms/ui';
import { PRESETS, SOURCES } from '../../lib/mailing/model';
import type { MailingListItem } from '../../lib/mailing/store';
import { PageHeader } from '../shared/PageHeader';
import { when } from './format';
import './mailing.css';

/**
 * /admin/mailing – every mailing, newest edit first: drafts and sent ones,
 * with how many mails each sent. "Create new" starts blank for a source or
 * from a preset (lib/mailing/model.ts `PRESETS`).
 */

type Props = { apiRoute: string; adminRoute: string };

export function MailingList({ apiRoute, adminRoute }: Props) {
  const router = useRouter();
  const [mailings, setMailings] = useState<MailingListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch(`${apiRoute}/mailing/mailings`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        setMailings(((await res.json()) as { mailings: MailingListItem[] }).mailings);
      })
      .catch((err: Error) => setError(`Could not load the mailings (${err.message}).`));
  }, [apiRoute]);

  const open = (id: number) => router.push(`${adminRoute}/mailing?id=${id}`);

  const create = async (presetKey: string) => {
    const preset = PRESETS.find((p) => p.key === presetKey);
    if (!preset || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`${apiRoute}/mailing/mailings`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: preset.title, source: preset.source, config: preset.config() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      open(((await res.json()) as { id: number }).id);
    } catch (err) {
      setError(`Could not create the mailing (${(err as Error).message}).`);
      setCreating(false);
    }
  };

  return (
    <div className="ml">
      <SetStepNav nav={[{ label: 'Mailing' }]} />
      <PageHeader
        title="Mailing"
        titleActions={[
          <Popup
            key="new"
            buttonType="custom"
            noBackground
            horizontalAlign="left"
            button={
              <Pill icon={<ChevronIcon />} alignIcon="right">
                {creating ? 'Creating…' : 'Create new'}
              </Pill>
            }
            render={({ close }) => (
              <PopupList.ButtonGroup>
                {PRESETS.map((p) => (
                  <PopupList.Button
                    key={p.key}
                    onClick={() => {
                      close();
                      void create(p.key);
                    }}
                  >
                    <span className="ml-preset">
                      <strong>{p.label}</strong>
                      <span>{p.description}</span>
                    </span>
                  </PopupList.Button>
                ))}
              </PopupList.ButtonGroup>
            )}
          />,
        ]}
        after={
          <ViewDescription description="Write to the applicants, the waitlist or the TechTour registrations in groups: each person gets the mail of the first group they fit, and every mail sent is kept here." />
        }
      />

      {error && <Banner type="error">{error}</Banner>}

      {mailings && mailings.length === 0 && (
        <p className="ml-empty">No mailings yet. Start one with “Create new”.</p>
      )}

      {mailings && mailings.length > 0 && (
        <div className="ml-table" role="table" aria-label="Mailings">
          <div className="ml-table__row ml-table__row--head" role="row">
            <span role="columnheader">Title</span>
            <span role="columnheader">To</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Last sent</span>
            <span role="columnheader">Edited</span>
          </div>
          {mailings.map((m) => (
            <button key={m.id} type="button" className="ml-table__row" role="row" onClick={() => open(m.id)}>
              <span role="cell" className="ml-table__title">
                {m.title}
              </span>
              <span role="cell">{SOURCES[m.source]?.label ?? m.source}</span>
              <span role="cell">
                {m.sends === 0 ? (
                  <span className="ml-badge">Draft</span>
                ) : (
                  <span className="ml-badge ml-badge--sent">
                    {m.sent} sent{m.failed ? ` · ${m.failed} failed` : ''}
                  </span>
                )}
              </span>
              <span role="cell">{m.lastSentAt ? when.format(new Date(m.lastSentAt)) : '–'}</span>
              <span role="cell">{when.format(new Date(m.updatedAt))}</span>
            </button>
          ))}
        </div>
      )}

      {!mailings && !error && <p className="ml-empty">Loading…</p>}
    </div>
  );
}
