import { describe, expect, it } from 'vitest';
import {
  decodeExternalId,
  docusealBase,
  encodeExternalId,
  isOpen,
  mergeStatus,
  parseWebhookEvent,
  secretMatches,
  signingUrl,
  statusFromSubmission,
  webhookSecret,
  type DocStatus,
} from './docuseal';

// Shapes as in DocuSeal's API reference (docs/api/form-webhook, submission-webhook, get-a-submission).
const formEvent = (type: string, extra: Record<string, unknown> = {}) => ({
  event_type: type,
  timestamp: '2026-11-10T13:48:36Z',
  data: {
    id: 1,
    email: 'max.mustermann@codingforchange.com',
    completed_at: type === 'form.completed' ? '2026-11-10T13:48:30.000Z' : null,
    external_id: 'cfc-onboarding:7:6730aa11bb22cc33dd44ee55',
    status: type === 'form.completed' ? 'completed' : 'opened',
    submission: { id: 12, status: 'pending', url: 'https://sign.example.org/e/abc' },
    ...extra,
  },
});
const submissionEvent = (type: string) => ({
  event_type: type,
  timestamp: '2026-11-10T14:00:00Z',
  data: { id: 12, status: type === 'submission.completed' ? 'completed' : 'pending', completed_at: null, submitters: [] },
});

describe('webhook events', () => {
  it('maps every form and submission event to a status', () => {
    const cases: [string, DocStatus][] = [
      ['form.viewed', 'opened'],
      ['form.started', 'opened'],
      ['form.completed', 'completed'],
      ['form.declined', 'declined'],
      ['submission.created', 'pending'],
      ['submission.completed', 'completed'],
      ['submission.expired', 'expired'],
      ['submission.archived', 'expired'],
    ];
    for (const [type, status] of cases) {
      const body = type.startsWith('form.') ? formEvent(type) : submissionEvent(type);
      expect(parseWebhookEvent(body)).toMatchObject({ type, status, submissionId: 12 });
    }
  });

  it('takes the submission id from data.submission.id for form events and data.id for submission events', () => {
    expect(parseWebhookEvent(formEvent('form.viewed'))?.submissionId).toBe(12);
    expect(parseWebhookEvent(formEvent('form.viewed'))?.externalId).toBe('cfc-onboarding:7:6730aa11bb22cc33dd44ee55');
    expect(parseWebhookEvent(submissionEvent('submission.expired'))?.externalId).toBeNull();
    // data.id of a form event is the submitter, never the submission.
    expect(parseWebhookEvent(formEvent('form.viewed', { submission: null }))?.submissionId).toBeNull();
  });

  it('keeps the completion time of DocuSeal, else of the event', () => {
    expect(parseWebhookEvent(formEvent('form.completed'))?.completedAt).toBe('2026-11-10T13:48:30.000Z');
    expect(parseWebhookEvent(submissionEvent('submission.completed'))?.completedAt).toBe('2026-11-10T14:00:00.000Z');
    expect(parseWebhookEvent(formEvent('form.viewed'))?.completedAt).toBeNull();
  });

  it('ignores template events and refuses what is not an event', () => {
    expect(parseWebhookEvent({ event_type: 'template.updated', data: { id: 3 } })).toMatchObject({ status: null, submissionId: null });
    expect(parseWebhookEvent(null)).toBeNull();
    expect(parseWebhookEvent({ event_type: 'form.completed' })).toBeNull();
    expect(parseWebhookEvent({ data: {} })).toBeNull();
    expect(parseWebhookEvent([])).toBeNull();
    expect(parseWebhookEvent(formEvent('form.viewed', { submission: { id: '12; DROP' } }))?.submissionId).toBeNull();
  });
});

describe('mergeStatus (duplicates and events out of order)', () => {
  it('only ever moves up', () => {
    expect(mergeStatus('pending', 'opened')).toBe('opened');
    expect(mergeStatus('opened', 'pending')).toBe('opened');
    expect(mergeStatus('opened', 'opened')).toBe('opened');
    expect(mergeStatus('pending', 'completed')).toBe('completed');
  });

  it('never leaves completed', () => {
    for (const s of ['pending', 'opened', 'declined', 'expired'] as DocStatus[]) expect(mergeStatus('completed', s)).toBe('completed');
  });

  it('keeps the first end between declined and expired, but a completion wins', () => {
    expect(mergeStatus('declined', 'expired')).toBe('declined');
    expect(mergeStatus('expired', 'declined')).toBe('expired');
    expect(mergeStatus('declined', 'opened')).toBe('declined');
    expect(mergeStatus('expired', 'completed')).toBe('completed');
  });

  it('gives the same result whatever order a run of events arrives in', () => {
    const events: DocStatus[] = ['pending', 'opened', 'opened', 'completed', 'completed'];
    const orders = [events, [...events].reverse(), ['completed', 'pending', 'opened', 'completed', 'opened'] as DocStatus[]];
    for (const order of orders) expect(order.reduce<string>((s, e) => mergeStatus(s, e), 'pending')).toBe('completed');
  });

  it('takes the incoming status over a value it does not know', () => {
    expect(mergeStatus('weird', 'opened')).toBe('opened');
  });

  it('isOpen: only pending and opened can be continued', () => {
    expect(['pending', 'opened', 'completed', 'declined', 'expired', 'not_started'].filter(isOpen)).toEqual(['pending', 'opened']);
  });
});

describe('statusFromSubmission (resync)', () => {
  const sub = (submitter: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    id: 12,
    status: 'pending',
    expire_at: null,
    archived_at: null,
    completed_at: null,
    submitters: [{ slug: 'mine', status: 'sent', opened_at: null, completed_at: null, declined_at: null, ...submitter }],
    ...extra,
  });
  const now = new Date('2026-11-10T12:00:00Z');

  it('reads the member submitter by slug', () => {
    expect(statusFromSubmission(sub({}), 'mine', now)).toEqual({ status: 'pending', completedAt: null });
    expect(statusFromSubmission(sub({ status: 'opened', opened_at: '2026-11-10T10:00:00Z' }), 'mine', now)?.status).toBe('opened');
    expect(statusFromSubmission(sub({ status: 'completed', completed_at: '2026-11-10T11:00:00Z' }), 'mine', now)).toEqual({
      status: 'completed',
      completedAt: '2026-11-10T11:00:00.000Z',
    });
    expect(statusFromSubmission(sub({ status: 'declined', declined_at: '2026-11-10T11:00:00Z' }), 'mine', now)?.status).toBe('declined');
  });

  it('sees expiry and archiving', () => {
    expect(statusFromSubmission(sub({}, { status: 'expired' }), 'mine', now)?.status).toBe('expired');
    expect(statusFromSubmission(sub({}, { expire_at: '2026-11-01T00:00:00Z' }), 'mine', now)?.status).toBe('expired');
    expect(statusFromSubmission(sub({}, { expire_at: '2026-12-01T00:00:00Z' }), 'mine', now)?.status).toBe('pending');
    expect(statusFromSubmission(sub({}, { archived_at: '2026-11-05T00:00:00Z' }), 'mine', now)?.status).toBe('expired');
    // Completed stays completed even when archived afterwards.
    expect(
      statusFromSubmission(sub({ status: 'completed', completed_at: '2026-11-04T00:00:00Z' }, { archived_at: '2026-11-05T00:00:00Z' }), 'mine', now)
        ?.status,
    ).toBe('completed');
  });

  it('is null for an answer of another shape or without the member', () => {
    expect(statusFromSubmission({}, 'mine', now)).toBeNull();
    expect(statusFromSubmission(null, 'mine', now)).toBeNull();
    expect(
      statusFromSubmission({ submitters: [{ slug: 'a', status: 'completed' }, { slug: 'b', status: 'completed' }] }, 'mine', now),
    ).toBeNull();
    // With one submitter only, it is ours even if the slug differs.
    expect(statusFromSubmission({ submitters: [{ slug: 'other', status: 'completed' }] }, 'mine', now)?.status).toBe('completed');
  });
});

describe('external id', () => {
  it('round-trips user and item', () => {
    const id = encodeExternalId(7, '6730aa11bb22cc33dd44ee55');
    expect(id).toBe('cfc-onboarding:7:6730aa11bb22cc33dd44ee55');
    expect(decodeExternalId(id)).toEqual({ user: 7, item: '6730aa11bb22cc33dd44ee55' });
  });

  it('refuses bad input both ways', () => {
    expect(() => encodeExternalId(0, 'x')).toThrow();
    expect(() => encodeExternalId(1.5, 'x')).toThrow();
    expect(() => encodeExternalId(7, 'a:b')).toThrow();
    expect(() => encodeExternalId(7, '')).toThrow();
    for (const bad of [null, 42, '', 'cfc-onboarding:7', 'cfc-onboarding:0:x', 'cfc-onboarding:07:x', 'other:7:x', 'cfc-onboarding:7:x:y', 'cfc-onboarding:7:a b']) {
      expect(decodeExternalId(bad)).toBeNull();
    }
  });
});

describe('webhook secret', () => {
  const secret = 'a'.repeat(16) + 'B9-secret-value';

  it('counts as unset when empty or short', () => {
    expect(webhookSecret(undefined)).toBeNull();
    expect(webhookSecret('')).toBeNull();
    expect(webhookSecret('   ')).toBeNull();
    expect(webhookSecret('short-secret')).toBeNull();
    expect(webhookSecret(`  ${secret}  `)).toBe(secret);
  });

  it('matches only the exact value', () => {
    expect(secretMatches(secret, secret)).toBe(true);
    expect(secretMatches(secret, `${secret} `)).toBe(false);
    expect(secretMatches(secret, secret.slice(0, -1))).toBe(false);
    expect(secretMatches(secret, secret.toUpperCase())).toBe(false);
    expect(secretMatches(secret, '')).toBe(false);
    expect(secretMatches(secret, null)).toBe(false);
    expect(secretMatches(secret, undefined)).toBe(false);
  });

  it('refuses everything without a configured secret', () => {
    expect(secretMatches(null, '')).toBe(false);
    expect(secretMatches(null, 'anything')).toBe(false);
    expect(secretMatches('', '')).toBe(false);
  });
});

describe('addresses', () => {
  it('normalises DOCUSEAL_URL and refuses other schemes', () => {
    expect(docusealBase('https://sign.example.org/')).toBe('https://sign.example.org');
    expect(docusealBase('')).toBeNull();
    expect(docusealBase(undefined)).toBeNull();
    expect(docusealBase('javascript:alert(1)')).toBeNull();
    expect(docusealBase('not a url')).toBeNull();
  });

  it('builds the signing link from the slug', () => {
    expect(signingUrl('https://sign.example.org', 'pAMimKcyrLjqVt')).toBe('https://sign.example.org/s/pAMimKcyrLjqVt');
    expect(() => signingUrl('https://sign.example.org', '../admin')).toThrow();
  });
});
