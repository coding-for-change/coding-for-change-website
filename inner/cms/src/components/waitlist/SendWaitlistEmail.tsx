'use client';
import React, { useEffect, useState } from 'react';
import { MANAGE_LINK_PLACEHOLDER } from '../../lib/manage/link';
import './waitlist-email.css';

/**
 * "Email all waitlist signups" panel above the Waitlist Signups list view
 * (registered via admin.components.beforeListTable in the collection config).
 * Composes a message and POSTs it to /api/waitlist/send-email, which delivers
 * an individual email to every unique signup address via Resend — recipients
 * never see each other's addresses. Mails are rendered through the branded
 * template (logo header, optional full-width image, optional button); the
 * preview pane below the fields shows the server's actual rendering via
 * /api/waitlist/email-preview, so what you see is exactly what goes out.
 * Collapsed by default so the list view stays uncluttered; "Send test" mails
 * only the logged-in admin, or a hand-picked list of preview addresses
 * (personal inboxes) when one is given.
 *
 * The same panel mails the TechTour registrations instead ("To"): one mail
 * per registration, where {{manageLink}} becomes that person's own
 * /techtour/manage link (endpoints/waitlistEmail.ts) – or only the
 * registrations marked as Coding for Change members in the review workspace
 * (lib/members.ts).
 */

type Audience = 'waitlist' | 'techtour';
/** What "To" offers: the waitlist, the TechTour registrations, or members' registrations only. */
type To = Audience | 'members';

type Counts = {
  total: number;
  /** TechTour only: distinct addresses among the registrations. */
  addresses?: number;
  byLocale: { locale: string; count: number }[];
};

type SendResult = {
  transport: 'resend' | 'console';
  requested: number;
  sent: number;
  failed: number;
  errors: string[];
};

type MediaDoc = {
  id: string | number;
  url?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  alt?: string | null;
};

const LOCALE_LABELS: Record<Audience, Record<string, string>> = {
  waitlist: {
    de: 'German signups (de)',
    en: 'English signups (en)',
    unknown: 'No language recorded',
  },
  techtour: {
    de: 'Registrations sent in German (de)',
    en: 'Registrations sent in English (en)',
    unknown: 'No language recorded',
  },
};

// Media docs carry site-relative URLs (/api/media/file/…); mail clients need
// absolute ones. The admin runs on the public domain, so its origin is right.
const toAbsolute = (u: string): string => {
  try {
    return new URL(u, window.location.origin).href;
  } catch {
    return u;
  }
};

export const SendWaitlistEmail: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<To>('waitlist');
  const [allCounts, setAllCounts] = useState<Partial<Record<To, Counts>>>({});
  const [countsError, setCountsError] = useState(false);
  const [media, setMedia] = useState<MediaDoc[] | null>(null);
  const [locale, setLocale] = useState(''); // '' = all signups
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState(''); // optional image at the top of the mail
  const [ctaLabel, setCtaLabel] = useState(''); // optional button under the message
  const [ctaUrl, setCtaUrl] = useState('');
  const [testTo, setTestTo] = useState(''); // optional preview addresses for test sends
  const [sending, setSending] = useState<null | 'test' | 'all'>(null);
  const [result, setResult] = useState<(SendResult & { wasTest?: boolean }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);

  const counts = allCounts[to] ?? null;
  const audience: Audience = to === 'waitlist' ? 'waitlist' : 'techtour';
  const techtour = audience === 'techtour';
  const membersOnly = to === 'members';

  useEffect(() => {
    if (!open || allCounts[to]) return;
    setCountsError(false);
    fetch(`/api/waitlist/email-recipients?audience=${audience}${membersOnly ? '&members=1' : ''}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: Counts) => setAllCounts((prev) => ({ ...prev, [to]: data })))
      .catch(() => setCountsError(true));
  }, [open, to, audience, membersOnly, allCounts]);

  // Images from the Media collection for the header-image picker. Filtered
  // client-side; a failure just leaves the picker empty (URL input still works).
  useEffect(() => {
    if (!open || media) return;
    fetch('/api/media?limit=100&sort=-createdAt&depth=0')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { docs?: MediaDoc[] }) =>
        setMedia((data.docs ?? []).filter((d) => (d.mimeType ?? '').startsWith('image/'))),
      )
      .catch(() => setMedia([]));
  }, [open, media]);

  // Live preview: debounce the compose fields, then ask the server for the
  // exact HTML the send endpoint would produce. Stale responses are aborted.
  useEffect(() => {
    if (!open) return;
    if (!message.trim()) {
      setPreviewHtml('');
      setPreviewError(null);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch('/api/waitlist/email-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          message: message.trim(),
          locale: locale || undefined,
          audience,
          headerImageUrl: headerImageUrl.trim() ? toAbsolute(headerImageUrl.trim()) : undefined,
          ctaLabel: ctaLabel.trim() || undefined,
          ctaUrl: ctaUrl.trim() || undefined,
        }),
      })
        .then(async (res) => {
          const data = (await res.json().catch(() => null)) as {
            html?: string;
            error?: string;
          } | null;
          if (!res.ok || !data?.html) {
            throw new Error(data?.error || `Preview failed (HTTP ${res.status}).`);
          }
          setPreviewHtml(data.html);
          setPreviewError(null);
        })
        .catch((err: unknown) => {
          if (ctrl.signal.aborted) return;
          setPreviewError(err instanceof Error ? err.message : 'Preview failed.');
        });
    }, 500);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [open, message, locale, audience, headerImageUrl, ctaLabel, ctaUrl]);

  const recipientCount = locale
    ? (counts?.byLocale.find((l) => l.locale === locale)?.count ?? 0)
    : (counts?.total ?? 0);

  const selectedMediaId =
    media?.find((m) => m.url && toAbsolute(m.url) === toAbsolute(headerImageUrl.trim()))?.id ?? '';

  const send = async (test: boolean) => {
    setError(null);
    setResult(null);
    if (!subject.trim() || !message.trim()) {
      setError('Subject and message are both required.');
      return;
    }
    if (!test) {
      const noun = techtour
        ? `TechTour registration${recipientCount === 1 ? '' : 's'}${membersOnly ? ' of Coding for Change members' : ''}`
        : `unique waitlist ${recipientCount === 1 ? 'address' : 'addresses'}`;
      if (
        !window.confirm(
          `Send “${subject.trim()}” to ${recipientCount} ${noun}? This cannot be undone.`,
        )
      ) {
        return;
      }
    }
    setSending(test ? 'test' : 'all');
    try {
      const res = await fetch('/api/waitlist/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          locale: locale || undefined,
          audience,
          members: membersOnly || undefined,
          headerImageUrl: headerImageUrl.trim() ? toAbsolute(headerImageUrl.trim()) : undefined,
          ctaLabel: ctaLabel.trim() || undefined,
          ctaUrl: ctaUrl.trim() || undefined,
          test,
          testRecipients: test && testTo.trim() ? testTo.trim() : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as (SendResult & { error?: string }) | null;
      if (!res.ok) {
        setError((data && typeof data.error === 'string' && data.error) || `Sending failed (HTTP ${res.status}).`);
        return;
      }
      if (data) setResult({ ...data, wasTest: test });
    } catch {
      setError('Sending failed — network error.');
    } finally {
      setSending(null);
    }
  };

  const busy = sending !== null;

  return (
    <div className="wl-email">
      <button
        type="button"
        className="wl-email__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ✉ Email all waitlist signups or TechTour registrations {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="wl-email__panel">
          <p className="wl-email__hint">
            Each person receives an <strong>individual</strong> email — recipients never see each
            other&apos;s addresses. Mails use the branded template (logo header, bilingual
            unsubscribe footer); plain URLs in the message become clickable links. Optionally add
            an image at the top and a button below the message — the preview underneath shows
            exactly what will be sent.
          </p>
          <div className="wl-email__row">
            <label className="wl-email__field">
              To
              <select
                value={to}
                onChange={(e) => {
                  setTo(e.target.value as To);
                  setLocale('');
                }}
                disabled={busy}
              >
                <option value="waitlist">Waitlist signups</option>
                <option value="techtour">TechTour registrations</option>
                <option value="members">TechTour registrations – members only</option>
              </select>
            </label>
            <label className="wl-email__field">
              Recipients
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                disabled={busy || !counts}
              >
                <option value="">
                  {!counts
                    ? 'Loading…'
                    : techtour
                      ? `All ${membersOnly ? 'members’ ' : ''}registrations (${counts.total}, ${counts.addresses ?? counts.total} addresses)`
                      : `All signups (${counts.total} unique)`}
                </option>
                {counts?.byLocale.map((l) => (
                  <option key={l.locale} value={l.locale}>
                    {LOCALE_LABELS[audience][l.locale] ?? `Language “${l.locale}”`} ({l.count})
                  </option>
                ))}
              </select>
            </label>
          </div>
          {techtour && (
            <div className="wl-email__notice wl-email__notice--info">
              <p className="wl-email__info-text">
                One mail per registration. Write <code>{MANAGE_LINK_PLACEHOLDER}</code> in the
                message or as the button link: each person gets their own link to /techtour/manage,
                where they can give up evenings until Sun 1 Nov, 23:59. Test mails and the preview
                carry a sample link that opens no registration.
                {membersOnly &&
                  ' Members only: the registrations marked “Coding for Change member” under Review applications → TechTour.'}
              </p>
              <div className="wl-email__info-actions">
                <button
                  type="button"
                  className="wl-email__btn wl-email__btn--secondary"
                  onClick={() => setMessage((m) => `${m}${m && !m.endsWith('\n') ? '\n\n' : ''}${MANAGE_LINK_PLACEHOLDER}`)}
                  disabled={busy}
                >
                  Add the link to the message
                </button>
                <button
                  type="button"
                  className="wl-email__btn wl-email__btn--secondary"
                  onClick={() => setCtaUrl(MANAGE_LINK_PLACEHOLDER)}
                  disabled={busy}
                >
                  Use it as the button link
                </button>
              </div>
            </div>
          )}
          {countsError && (
            <div className="wl-email__notice wl-email__notice--error">
              Could not load recipient counts — are you still logged in?
            </div>
          )}
          <label className="wl-email__field">
            Subject
            <input
              type="text"
              value={subject}
              maxLength={200}
              placeholder="e.g. Our next event — save your spot"
              onChange={(e) => setSubject(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="wl-email__field">
            Message
            <textarea
              value={message}
              rows={8}
              placeholder={'Hi!\n\nHere is the link to our event: https://lu.ma/…'}
              onChange={(e) => setMessage(e.target.value)}
              disabled={busy}
            />
          </label>
          <div className="wl-email__field">
            Header image (optional — shown as a card on a tinted banner at the top; the banner
            color adapts to the image. Square-ish artwork works well, keep the file small)
            <select
              value={String(selectedMediaId)}
              onChange={(e) => {
                const doc = media?.find((m) => String(m.id) === e.target.value);
                setHeaderImageUrl(doc?.url ? toAbsolute(doc.url) : '');
              }}
              disabled={busy}
            >
              <option value="">
                {media === null ? 'Loading Media…' : 'None — or pick an upload from Media'}
              </option>
              {media?.map((m) => (
                <option key={String(m.id)} value={String(m.id)}>
                  {m.filename ?? String(m.id)}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={headerImageUrl}
              placeholder="…or paste an https:// image URL"
              onChange={(e) => setHeaderImageUrl(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="wl-email__row">
            <label className="wl-email__field">
              Button label (optional)
              <input
                type="text"
                value={ctaLabel}
                maxLength={100}
                placeholder="e.g. Save your spot"
                onChange={(e) => setCtaLabel(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="wl-email__field">
              Button link
              <input
                type="text"
                value={ctaUrl}
                placeholder="https://lu.ma/…"
                onChange={(e) => setCtaUrl(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>
          <label className="wl-email__field">
            Test recipients (optional, comma-separated — used by “Send test” to preview the mail
            in personal inboxes; defaults to your admin address)
            <input
              type="text"
              value={testTo}
              placeholder="you@gmail.com, someone@icloud.com"
              onChange={(e) => setTestTo(e.target.value)}
              disabled={busy}
            />
          </label>
          <div className="wl-email__field">
            Preview
            {previewHtml ? (
              <div className="wl-email__preview">
                <iframe
                  className="wl-email__preview-frame"
                  title="Email preview"
                  sandbox=""
                  referrerPolicy="no-referrer"
                  srcDoc={previewHtml}
                />
              </div>
            ) : (
              <div className="wl-email__preview wl-email__preview--empty">
                Type a message above to see the rendered mail.
              </div>
            )}
            {previewError && (
              <div className="wl-email__notice wl-email__notice--warn">{previewError}</div>
            )}
          </div>
          <div className="wl-email__actions">
            <button
              type="button"
              className="wl-email__btn wl-email__btn--secondary"
              onClick={() => void send(true)}
              disabled={busy}
            >
              {sending === 'test'
                ? 'Sending test…'
                : testTo.trim()
                  ? 'Send test to listed addresses'
                  : 'Send test to me'}
            </button>
            <button
              type="button"
              className="wl-email__btn wl-email__btn--primary"
              onClick={() => void send(false)}
              disabled={busy || !counts || recipientCount === 0}
            >
              {sending === 'all'
                ? 'Sending…'
                : `Send to ${counts ? recipientCount : '…'} recipient${recipientCount === 1 ? '' : 's'}`}
            </button>
          </div>
          {error && <div className="wl-email__notice wl-email__notice--error">{error}</div>}
          {result && (
            <div
              className={`wl-email__notice ${
                result.failed > 0 ? 'wl-email__notice--warn' : 'wl-email__notice--ok'
              }`}
            >
              {result.transport === 'console'
                ? `No RESEND_API_KEY configured — ${result.sent} mail(s) were logged to the server console instead of being sent (dev mode).`
                : result.failed > 0
                  ? `Sent ${result.sent} of ${result.requested}; ${result.failed} failed.${result.errors[0] ? ` First error: ${result.errors[0]}` : ''}`
                  : result.wasTest
                    ? `Test sent to ${result.sent} address${result.sent === 1 ? '' : 'es'} — subject is prefixed “[Test]”. Check the inbox (and spam folder).`
                    : `Sent ${result.sent} email${result.sent === 1 ? '' : 's'}.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
