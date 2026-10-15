'use client';
import React, { useEffect, useState } from 'react';
import { Button, CopyToClipboard, FieldDescription, TextInput, useFormFields } from '@payloadcms/ui';
import './share.css';

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * The share link itself, in the sidebar like any other field: the address
 * (read-only, with Payload's copy button), whether it works right now, and a
 * ready-made email to the contacts – it opens the team's own mail program;
 * nothing is sent from here.
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
  // The site's own address – read in the browser, never during server rendering.
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  if (!token) {
    return (
      <div className="field-type share-url">
        <TextInput path="shareLink" label="Link" readOnly value="" placeholder="Appears once you save" />
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
      'Please use the registrations only to decide who joins your evening and to prepare it, and delete any CVs you download once the evening is over. Once you admit someone you will see their email address, so you can contact them to register – please use it for nothing else.',
      'Thank you!',
      'Coding for Change',
    ]
      .filter(Boolean)
      .join('\n\n'),
  )}`;

  return (
    <div className={`field-type share-url${blocked || expired ? ' share-url--off' : ''}`}>
      <TextInput
        path="shareLink"
        label="Link"
        readOnly
        value={url}
        AfterInput={<CopyToClipboard value={url} defaultMessage="Copy link" successMessage="Copied" />}
      />
      <FieldDescription path="shareLink" description={status} />
      {contacts.length > 0 && (
        <Button buttonStyle="secondary" size="small" el="anchor" url={mail} margin={false}>
          Write to the contacts
        </Button>
      )}
    </div>
  );
};
