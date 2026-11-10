import type { CurrentCheck, CurrentDocument } from './store';
import type { DocumentState, MemberProfile, OnboardingMember, OnboardingTodo, TodoState } from './types';

/**
 * One member's row in the dashboard, put together from their account, the
 * onboarding settings and the onboarding tables. Pure, so it can be tested.
 */

export type MemberAccount = {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  privateEmail?: string | null;
  role?: string | null;
  application?: number | { id: number } | null;
  accountExportedAt?: string | null;
  signedInAt?: string | null;
};

export type ProgressInput = {
  account: MemberAccount;
  memberTodos: OnboardingTodo[];
  boardTodos: OnboardingTodo[];
  documents: { id: string; title: string }[];
  /** This account's current checks (both kinds) and documents. */
  checks: CurrentCheck[];
  started: CurrentDocument[];
  formConfigured: boolean;
  formSubmittedAt: string | null;
  profile: MemberProfile | null;
  /** Without DocuSeal the documents cannot be signed, so they do not hold the member up (as in `ownStepsDone`). */
  docusealConfigured: boolean;
};

const idOf = (v: number | { id: number } | null | undefined): number | null =>
  v == null ? null : typeof v === 'object' ? v.id : v;

function todoStates(todos: OnboardingTodo[], checks: CurrentCheck[], kind: 'member' | 'board'): TodoState[] {
  return todos.map((t) => {
    const c = checks.find((x) => x.kind === kind && x.item === t.id);
    return { id: t.id, text: t.text, done: Boolean(c?.done), at: c?.at ?? null, by: c?.by ?? null };
  });
}

export function memberProgress(input: ProgressInput): OnboardingMember {
  const { account } = input;
  const memberTodos = todoStates(input.memberTodos, input.checks, 'member');
  const boardTodos = todoStates(input.boardTodos, input.checks, 'board');
  const documents: DocumentState[] = input.documents.map((d) => {
    const s = input.started.find((x) => x.item === d.id);
    return {
      id: d.id,
      title: d.title,
      status: s?.status ?? 'not_started',
      startedAt: s?.startedAt ?? null,
      completedAt: s?.completedAt ?? null,
      submissionId: s?.submissionId ?? null,
    };
  });
  const signedInAt = account.signedInAt ?? null;
  const complete =
    signedInAt !== null &&
    (!input.formConfigured || input.formSubmittedAt !== null) &&
    memberTodos.every((t) => t.done) &&
    boardTodos.every((t) => t.done) &&
    (!input.docusealConfigured || documents.every((d) => d.status === 'completed'));
  return {
    id: account.id,
    email: account.email,
    firstName: account.firstName ?? '',
    lastName: account.lastName ?? '',
    privateEmail: account.privateEmail ?? '',
    role: account.role ?? 'member',
    application: idOf(account.application),
    accountExportedAt: account.accountExportedAt ?? null,
    signedInAt,
    formSubmittedAt: input.formSubmittedAt,
    memberTodos,
    boardTodos,
    documents,
    profile: input.profile,
    complete,
  };
}


/**
 * Whether a member has done everything that is theirs to do: the form (when
 * one is set), every member to-do, and every document, but documents only
 * when DocuSeal is configured (without it the page cannot offer them, so they
 * cannot hold the member up). The board's to-dos are not theirs. Drives the
 * "all done" notice to the board (lib/onboarding/notify.ts).
 */
export function ownStepsDone(input: {
  formConfigured: boolean;
  formSubmittedAt: string | null;
  todos: { done: boolean }[];
  documents: { status: string }[];
  docusealConfigured: boolean;
}): boolean {
  return (
    (!input.formConfigured || input.formSubmittedAt !== null) &&
    input.todos.every((t) => t.done) &&
    (!input.docusealConfigured || input.documents.every((d) => d.status === 'completed'))
  );
}
