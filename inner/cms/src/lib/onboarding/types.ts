/**
 * What GET /api/onboarding/admin/overview answers (endpoints/onboarding.ts),
 * for the board's dashboard (components/onboarding/). Dates are ISO strings.
 */

/** A to-do of the onboarding settings, in English. */
export type OnboardingTodo = { id: string; text: string; linkUrl: string | null; linkLabel: string | null };

/** An application at stage "admitted" with no account yet. */
export type AdmittedPerson = {
  application: number;
  appliedAt: string;
  firstName: string;
  lastName: string;
  /** The address they applied with: the Google account's recovery address. */
  privateEmail: string;
  /** vorname.nachname@domain, free of every existing account and of the people listed before; null when the name gives none. */
  proposedEmail: string | null;
};

export type TodoState = { id: string; text: string; done: boolean; at: string | null; by: string | null };

/** "not_started" until the member starts it; then DocuSeal's status (tables.ts). */
export type DocumentState = { id: string; title: string; status: string; completedAt: string | null };

/** The member's public `team` entry. `title` is its `role` (English). */
export type MemberProfile = { id: number; name: string; title: string; published: boolean; projects: number[] };

export type OnboardingMember = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  privateEmail: string;
  role: string;
  application: number | null;
  accountExportedAt: string | null;
  signedInAt: string | null;
  /** When the member last sent the onboarding form; null when not yet (or when no form is set). */
  formSubmittedAt: string | null;
  memberTodos: TodoState[];
  boardTodos: TodoState[];
  documents: DocumentState[];
  /** null until the onboarding form made their team entry. */
  profile: MemberProfile | null;
  /** Signed in, form sent and every to-do and document done. */
  complete: boolean;
};

export type OnboardingOverview = {
  domain: string;
  orgUnitPath: string;
  onboardingUrl: string;
  formConfigured: boolean;
  projects: { id: number; title: string }[];
  admitted: AdmittedPerson[];
  members: OnboardingMember[];
};
