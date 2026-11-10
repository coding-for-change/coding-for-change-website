import { describe, expect, it } from 'vitest';
import { memberProgress, ownStepsDone, type ProgressInput } from './progress';

const base: ProgressInput = {
  account: { id: 7, email: 'max.mustermann@codingforchange.com', firstName: 'Max', lastName: 'Mustermann', signedInAt: '2026-11-01T10:00:00.000Z', application: { id: 3 } },
  memberTodos: [{ id: 'm1', text: 'Join Slack', linkUrl: null, linkLabel: null }],
  boardTodos: [{ id: 'b1', text: 'Add to GitHub', linkUrl: null, linkLabel: null }],
  documents: [{ id: 'd1', title: 'Membership declaration' }],
  checks: [],
  started: [],
  formConfigured: true,
  formSubmittedAt: null,
  profile: null,
  docusealConfigured: true,
};

const at = '2026-11-02T10:00:00.000Z';

describe('memberProgress', () => {
  it('starts with nothing done', () => {
    const m = memberProgress(base);
    expect(m.application).toBe(3);
    expect(m.memberTodos[0]).toMatchObject({ id: 'm1', done: false });
    expect(m.documents[0].status).toBe('not_started');
    expect(m.complete).toBe(false);
  });

  it('is complete once everything is done, and the newest check counts', () => {
    const m = memberProgress({
      ...base,
      formSubmittedAt: at,
      checks: [
        { user: 7, kind: 'member', item: 'm1', done: true, text: 'Join Slack', by: 'max', at },
        { user: 7, kind: 'board', item: 'b1', done: true, text: 'Add to GitHub', by: 'board', at },
      ],
      started: [{ user: 7, item: 'd1', title: 'x', status: 'completed', submissionId: 1, submitterSlug: 's', startedAt: at, completedAt: at }],
    });
    expect(m.complete).toBe(true);
    expect(m.boardTodos[0]).toMatchObject({ done: true, by: 'board', at });
  });

  it('is not complete with an unticked board to-do or before the first sign-in', () => {
    const done = {
      ...base,
      formSubmittedAt: at,
      checks: [{ user: 7, kind: 'member' as const, item: 'm1', done: true, text: '', by: '', at }],
      started: [{ user: 7, item: 'd1', title: 'x', status: 'completed', submissionId: 1, submitterSlug: 's', startedAt: at, completedAt: at }],
    };
    expect(memberProgress(done).complete).toBe(false);
    expect(memberProgress({ ...done, boardTodos: [] }).complete).toBe(true);
    expect(memberProgress({ ...done, boardTodos: [], account: { ...base.account, signedInAt: null } }).complete).toBe(false);
  });

  it('does not wait for documents without DocuSeal', () => {
    const rest = {
      ...base,
      boardTodos: [],
      formSubmittedAt: at,
      checks: [{ user: 7, kind: 'member' as const, item: 'm1', done: true, text: '', by: '', at }],
    };
    expect(memberProgress(rest).complete).toBe(false);
    expect(memberProgress({ ...rest, docusealConfigured: false }).complete).toBe(true);
  });

  it('carries the submission id and start of each document', () => {
    const m = memberProgress({
      ...base,
      started: [{ user: 7, item: 'd1', title: 'x', status: 'opened', submissionId: 41, submitterSlug: 's', startedAt: at, completedAt: null }],
    });
    expect(m.documents[0]).toEqual({ id: 'd1', title: 'Membership declaration', status: 'opened', startedAt: at, completedAt: null, submissionId: 41 });
  });

  it('does not wait for a form when none is set', () => {
    expect(memberProgress({ ...base, memberTodos: [], boardTodos: [], documents: [], formConfigured: false }).complete).toBe(true);
  });
});

describe('ownStepsDone', () => {
  const done = { formConfigured: true, formSubmittedAt: at, todos: [{ done: true }], documents: [{ status: 'completed' }], docusealConfigured: true };

  it('needs the form, every to-do and every document', () => {
    expect(ownStepsDone(done)).toBe(true);
    expect(ownStepsDone({ ...done, formSubmittedAt: null })).toBe(false);
    expect(ownStepsDone({ ...done, todos: [{ done: true }, { done: false }] })).toBe(false);
    expect(ownStepsDone({ ...done, documents: [{ status: 'pending' }] })).toBe(false);
  });

  it('does not wait for documents without DocuSeal, nor for a form that is not set', () => {
    expect(ownStepsDone({ ...done, documents: [{ status: 'not_started' }], docusealConfigured: false })).toBe(true);
    expect(ownStepsDone({ ...done, formConfigured: false, formSubmittedAt: null })).toBe(true);
  });
});
