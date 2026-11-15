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
export type DocumentState = {
  id: string;
  title: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  /** DocuSeal's id of the current submission; null when not started. */
  submissionId: number | null;
};

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
  /** When the sign-in details were last mailed to the private address (accountMail.ts); null when never. */
  accountMailedAt: string | null;
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
  /** DocuSeal on this server: `url` is DOCUSEAL_URL (for links to submissions), null when not configured. */
  docuseal: { configured: boolean; url: string | null };
  projects: { id: number; title: string }[];
  /** Every account's address on `domain`, lower case: what a proposal for someone added by hand must avoid (lib/onboarding/manual.ts). */
  accountAddresses: string[];
  /** The mail with the sign-in details as set in Onboarding Settings (or the built-in text), and whether this server can send mail. */
  accountMail: { subject: string; message: string; canSend: boolean };
  admitted: AdmittedPerson[];
  members: OnboardingMember[];
};

/** One person of an uploaded Google CSV in POST /api/onboarding/admin/account-mails. Never carries the password. */
export type AccountMailRecipient = {
  /** The association address, as in the file. */
  email: string;
  name: string;
  /** The private address the mail goes to; null when it cannot be sent. */
  to: string | null;
  /**
   * ready: can be sent. sent / failed: what happened in this request.
   * no_account: no onboarding account has this address. no_private: the account has no private address.
   */
  status: 'ready' | 'sent' | 'failed' | 'no_account' | 'no_private';
  /** When they were mailed before this request; null when never. */
  mailedAt: string | null;
};

export type AccountMailAnswer = {
  recipients: AccountMailRecipient[];
  /** Rows of the file that were left out, in words. */
  problems: string[];
  sent: number;
  failed: number;
};

// ---- the member's own page --------------------------------------------------

/**
 * What GET /api/onboarding/me answers (endpoints/onboardingMember.ts), for
 * the member's page /onboarding on the public site. Always the caller's own
 * account, in the language asked for (`?locale=de|en`, falling back to
 * English where a text has no German). POST /api/onboarding/me/check answers
 * the same. Dates are ISO strings.
 */
export type MemberTodo = {
  id: string;
  text: string;
  linkUrl: string | null;
  linkLabel: string | null;
  done: boolean;
  /** When it was ticked (or the tick taken back); null when never. */
  at: string | null;
};

export type MemberDocument = {
  id: string;
  title: string;
  description: string | null;
  /** "not_started" until the member starts it; then DocuSeal's status ("pending", "opened", "completed", "declined", "expired"). */
  status: string;
  startedAt: string | null;
  completedAt: string | null;
};

/** The form-builder document of the onboarding form, as the page renders it (CmsForm). */
export type MemberFormDoc = {
  id: number;
  title: string;
  fields: unknown[];
  submitButtonLabel: string | null;
  confirmationMessage: unknown;
};

export type MemberOnboardingView = {
  locale: 'en' | 'de';
  member: { id: number; email: string; firstName: string; lastName: string; role: string };
  /** Plain text; a blank line starts a new paragraph. Empty when none is set. */
  intro: string;
  /** Null when the board has not chosen a form (the page then leaves the section out). */
  form: null | {
    doc: MemberFormDoc;
    /** When the member last sent it; null when never. */
    sentAt: string | null;
    /** Their answers of the last time, by field name, to start the next one from. Null when never sent. */
    previous: Record<string, string> | null;
  };
  todos: MemberTodo[];
  documents: {
    /** DocuSeal is set up on this server (DOCUSEAL_URL and DOCUSEAL_API_KEY). Without it the page hides the section. */
    configured: boolean;
    items: MemberDocument[];
  };
  /** Their team profile, once the form made one. */
  profile: null | { published: boolean; hasPhoto: boolean };
  /** Their newest uploaded photo (private to them until published), for the LinkedIn picture; null without one. */
  photoUrl: string | null;
  /** Form, own to-dos and (with DocuSeal) documents all done (progress.ts `ownStepsDone`). */
  stepsDone: boolean;
};
