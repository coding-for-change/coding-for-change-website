'use client';
import React, { useEffect, useState } from 'react';
import { useFormFields } from '@payloadcms/ui';
import './share.css';

type Contact = { email?: string; name?: string };

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * The share link itself, in the sidebar: the address to send, whether it
 * works right now, a copy button and a ready-made email to the contacts
 * (opens the team's own mail program – nothing is sent from here).
 */
export const ShareLinkUrl: React.FC = () => {
  const token = useFormFields(([f]) => f.token?.value) as string | undefined;
  const title = useFormFields(([f]) => f.title?.value) as string | undefined;
  const expiresAt = useFormFields(([f]) => f.expiresAt?.value) as string | undefined;
  const blocked = useFormFields(([f]) => f.blocked?.value) as boolean | undefined;
  const contacts = useFormFields(([f]) =>
    Object.entries(f)
      .filter(([k]) => /^recipients\.\d+\.email$/.test(k))
      .map(([, v]) => v?.value as string)
      .filter(Boolean),
  ) as string[];
  const [copied, setCopied] = useState(false);
  // The site's own address – read in the browser, never during server rendering.
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  if (!token) {
    return (
      <div className="share-url">
        <p className="share-url__label">Link</p>
        <p className="share-url__hint">The link appears here once you save.</p>
      </div>
    );
  }

  const url = `${origin}/share/${token}`;
  const until = expiresAt ? new Date(expiresAt) : null;
  const expired = !until || until.getTime() <= Date.now();
  const status = blocked ? 'Blocked – nobody can open it.' : expired ? 'Expired.' : `Works until ${fmt.format(until!)}.`;

  const mail = `mailto:${contacts.join(',')}?subject=${encodeURIComponent(
    `Registrations for your TechTour evening${title ? ` – ${title}` : ''}`,
  )}&body=${encodeURIComponent(
    [
      'Hello,',
      `here is the private link to the registrations for your Munich TechTour evening${title ? ` (${title})` : ''}:`,
      url,
      'Sign in with this email address – you will get a six-digit code. For each person you can admit or decline; we let everyone know.',
      until ? `The link works until ${fmt.format(until)}.` : '',
      'Please use the registrations only to decide who joins your evening and to prepare it, and delete any CVs you download once the evening is over.',
      'Thank you!',
      'Coding for Change',
    ]
      .filter(Boolean)
      .join('\n\n'),
  )}`;

  return (
    <div className="share-url">
      <p className="share-url__label">Link</p>
      <input className="share-url__input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      <p className={`share-url__status${blocked || expired ? ' is-off' : ''}`}>{status}</p>
      <div className="share-url__actions">
        <button
          type="button"
          className="share-url__btn"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
        {contacts.length > 0 && (
          <a className="share-url__btn" href={mail}>
            Write to the contacts
          </a>
        )}
      </div>
    </div>
  );
};
