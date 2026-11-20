'use client';
import { Banner, Button } from '@payloadcms/ui';
import React, { useState } from 'react';
import type { AccountMailAnswer, AccountMailRecipient, OnboardingOverview } from '../../lib/onboarding/types';

/**
 * "Email sign-in details" in the onboarding dashboard: for when the password
 * sheets were not handed over in person. The board picks the google-users.csv
 * of an earlier download (the only place the first passwords exist), checks
 * who would get a mail at which private address, may change the text for
 * this send, and sends (POST /api/onboarding/admin/account-mails).
 *
 * The file is read in the browser and kept in memory only while this panel
 * is open: no storage, and the server answers without the passwords.
 */

type Props = {
  apiRoute: string;
  adminRoute: string;
  template: OnboardingOverview['accountMail'];
  onSent: () => void;
  onClose: () => void;
};

const STATUS: Record<AccountMailRecipient['status'], string> = {
  ready: 'Ready',
  sent: 'Sent',
  failed: 'Failed',
  no_account: 'No onboarding account with this address',
  no_private: 'The account has no private address',
};

const day = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

export function AccountMails({ apiRoute, adminRoute, template, onSent, onClose }: Props) {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [subject, setSubject] = useState(template.subject);
  const [message, setMessage] = useState(template.message);
  const [answer, setAnswer] = useState<AccountMailAnswer | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  const call = async (text: string, send: boolean): Promise<AccountMailAnswer | null> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiRoute}/onboarding/admin/account-mails`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text, subject, message, send, ...(send ? { only: [...picked] } : {}) }),
      });
      const body = (await res.json().catch(() => null)) as (AccountMailAnswer & { error?: string }) | null;
      if (!res.ok || !body) {
        setError(body?.error ?? `${res.status} ${res.statusText}`);
        return null;
      }
      return body;
    } catch {
      setError('The server could not be reached.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const choose = async (file: File | undefined) => {
    setAnswer(null);
    setArmed(false);
    setCsv(null);
    setFileName('');
    if (!file) return;
    const text = await file.text();
    const checked = await call(text, false);
    if (!checked) return;
    setCsv(text);
    setFileName(file.name);
    setAnswer(checked);
    // People mailed before stay unticked: a second mail is a decision, not a default.
    setPicked(new Set(checked.recipients.filter((r) => r.status === 'ready' && !r.mailedAt).map((r) => r.email)));
  };

  const send = async () => {
    if (!csv) return;
    setArmed(false);
    const done = await call(csv, true);
    if (!done) return;
    setAnswer(done);
    setPicked(new Set());
    // The passwords are not needed any more once the mails are out.
    setCsv(null);
    onSent();
  };

  const toggle = (email: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(email);
      else next.delete(email);
      return next;
    });

  const finished = answer !== null && csv === null;
  const count = picked.size;

  return (
    <div className="ob-mails">
      <div className="ob-mails__head">
        <h3>Email sign-in details</h3>
        <button type="button" className="ob-linkbtn" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="ob-hint">
        For when the password sheets were not handed over in person. Choose the google-users.csv from the download
        (inside the ZIP): each person in it gets one mail at their private address with their association address,
        their first password and their password sheet attached. Use the file of the latest export, and only after its
        CSV was uploaded in Google Admin: an older file holds passwords that no longer work. The file is not stored.
      </p>
      {!template.canSend && (
        <Banner type="error">This server has no mail provider configured (RESEND_API_KEY), so nothing can be sent.</Banner>
      )}
      {error && <Banner type="error">{error}</Banner>}

      <label className="ob-label" htmlFor="ob-mails-file">
        Google users CSV
      </label>
      <input
        id="ob-mails-file"
        type="file"
        accept=".csv,text/csv"
        disabled={busy}
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {fileName && !finished && <span className="ob-muted"> {fileName}</span>}

      {answer && (
        <>
          {answer.problems.length > 0 && (
            <ul className="ob-problems">
              {answer.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {finished && (
            <Banner type={answer.failed ? 'error' : 'success'}>
              {`${answer.sent} sent${answer.failed ? `, ${answer.failed} failed. Choose the file again to retry the failed ones.` : '.'}`}
            </Banner>
          )}
          <div className="ob-table ob-mails__table" role="table">
            <div className="ob-table__row ob-table__row--head" role="row">
              <span role="columnheader" />
              <span role="columnheader">Name</span>
              <span role="columnheader">Association address</span>
              <span role="columnheader">Mail goes to</span>
              <span role="columnheader">Status</span>
            </div>
            {answer.recipients.map((r) => (
              <div key={r.email} className="ob-table__row" role="row">
                <span role="cell">
                  {r.status === 'ready' && !finished && (
                    <input
                      type="checkbox"
                      aria-label={`Send to ${r.name}`}
                      checked={picked.has(r.email)}
                      disabled={busy}
                      onChange={(e) => toggle(r.email, e.target.checked)}
                    />
                  )}
                </span>
                <span role="cell">{r.name}</span>
                <span role="cell" className="ob-mono">
                  {r.email}
                </span>
                <span role="cell" className="ob-mono">
                  {r.to ?? ''}
                </span>
                <span role="cell" className={r.status === 'sent' ? 'ob-yes' : r.status === 'ready' ? undefined : 'ob-no'}>
                  {STATUS[r.status]}
                  {r.mailedAt && r.status !== 'sent' && <span className="ob-muted"> · mailed {day(r.mailedAt)}</span>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {!finished && (
        <>
          <label className="ob-label" htmlFor="ob-mails-subject">
            Subject
          </label>
          <input
            id="ob-mails-subject"
            className="ob-input"
            value={subject}
            maxLength={200}
            disabled={busy}
            onChange={(e) => setSubject(e.target.value)}
          />
          <label className="ob-label" htmlFor="ob-mails-message">
            Message
          </label>
          <textarea
            id="ob-mails-message"
            className="ob-input ob-mails__message"
            value={message}
            rows={16}
            maxLength={10000}
            disabled={busy}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="ob-hint">
            {'Placeholders: {{firstName}}, {{lastName}}, {{email}}, {{password}}, {{onboardingUrl}}. Changes here apply to this send only; the lasting text is in '}
            <a href={`${adminRoute}/globals/onboarding`}>Onboarding Settings</a>
            {' under "Mail with the sign-in details".'}
          </p>
          <div className="ob-actions">
            {armed ? (
              <>
                <Button size="small" margin={false} disabled={busy || count === 0} onClick={() => void send()}>
                  {busy ? 'Sending…' : `Yes, send ${count} ${count === 1 ? 'mail' : 'mails'} with passwords now`}
                </Button>
                <Button buttonStyle="secondary" size="small" margin={false} disabled={busy} onClick={() => setArmed(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="small"
                margin={false}
                disabled={busy || !csv || count === 0 || !template.canSend}
                onClick={() => setArmed(true)}
              >
                {busy ? 'Checking…' : `Send ${count} ${count === 1 ? 'mail' : 'mails'}`}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
