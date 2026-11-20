import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type Payload,
  type PayloadRequest,
} from 'payload';
import { roleOf } from '../../access/roles';
import { notifyFormReceived, notifyIfStepsDone } from './notify';
import { isOwnPhoto, removeUnusedPhotos } from './photo';
import {
  PLACEHOLDER_TITLE,
  profileLinks,
  profileName,
  readMemberAnswers,
  type MemberAnswers,
} from './memberForm';

/**
 * The form-submissions hooks of the onboarding (payload.config.ts):
 *
 * 1. `requireLoginForForm` (beforeOperation, create): a form with "Requires
 *    sign-in" (`forms.requiresLogin`) takes submissions from a signed-in
 *    `users` account only; anyone else gets 401. Every other form stays open
 *    to everyone, as before.
 * 2. `checkOnboardingAnswers` (beforeChange, create): for the onboarding form
 *    (the `onboarding` global's `form`), the answers with fixed names
 *    (memberForm.ts) are checked first, a wrong one refuses the submission
 *    with 400 and the reason, so nothing half-valid is stored. A photo must be
 *    one this member uploaded.
 * 3. `syncOnboardingSubmission` (afterChange, create, same transaction):
 *    copies the answers to the member's account and, with `profilePublic`
 *    ticked, creates or updates their `team` entry, always unpublished, and
 *    links it as `users.teamProfile`. Then the board is told (notify.ts).
 *
 * The profile and consent rules, decided here:
 *
 * - A second submission updates the same team entry (the one in
 *   `teamProfile`), never a second one. It goes back to unpublished: the
 *   board looks at the new texts before they are public again.
 * - Without `profilePublic` no entry is made and no photo is kept. Taking the
 *   consent back in a later submission unpublishes the entry, takes the photo
 *   off it and deletes the member's photos; the entry itself (name, title,
 *   projects) stays unpublished for the board, who can delete it under Team.
 *   The board's mail says so.
 * - A new profile starts with the title "Member" / "Mitglied"
 *   (PLACEHOLDER_TITLE): `team.role` is required, and the dashboard's title
 *   field then replaces both languages with the board's title (see
 *   `profile` in endpoints/onboarding.ts). Later submissions never touch it.
 */

const idOf = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === 'object') return idOf((v as { id?: unknown }).id);
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

type FormFlags = { id: number; requiresLogin?: boolean | null };

async function formOf(req: PayloadRequest, form: unknown): Promise<FormFlags | null> {
  const id = idOf(form);
  if (id === null) return null;
  return (await req.payload
    .findByID({ collection: 'forms', id, depth: 0, select: { requiresLogin: true }, overrideAccess: true, req })
    .catch(() => null)) as FormFlags | null;
}

/** The onboarding form's id (the `onboarding` global), or null when none is set. */
export async function onboardingFormId(payload: Payload, req?: PayloadRequest): Promise<number | null> {
  const global = (await payload
    .findGlobal({ slug: 'onboarding', depth: 0, overrideAccess: true, req })
    .catch(() => null)) as { form?: unknown } | null;
  return idOf(global?.form);
}

/** 1. Members-only forms. */
export const requireLoginForForm: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== 'create') return args;
  const data = (args as { data?: { form?: unknown } }).data;
  const form = await formOf(req, data?.form);
  if (form?.requiresLogin && roleOf(req.user) === null) {
    throw new APIError('Please sign in to send this form.', 401, null, true);
  }
  return args;
};

/** 2. The fixed-name answers of the onboarding form, before anything is stored. */
export const checkOnboardingAnswers: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create' || !data) return data;
  const formId = idOf(data.form);
  if (formId === null || formId !== (await onboardingFormId(req.payload, req))) return data;
  const user = roleOf(req.user) ? idOf(req.user?.id) : null;
  if (user === null) throw new APIError('Please sign in to send this form.', 401, null, true);
  const { answers, problems } = readMemberAnswers(data.submissionData);
  if (answers.photo !== null && !(await isOwnPhoto(req.payload, user, answers.photo, req))) {
    problems.push({ field: 'photo', message: 'The photo upload did not go through. Please upload it again.' });
  }
  if (problems.length > 0) {
    throw new APIError(problems.map((p) => `${p.field}: ${p.message}`).join(' '), 400, { problems }, true);
  }
  return data;
};

type Account = {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  githubUsername?: string | null;
  teamProfile?: unknown;
};

type TeamDoc = {
  id: number;
  role?: string | null;
  image?: unknown;
  published?: boolean | null;
  links?: { id?: string | null; label: string; url: string }[] | null;
};

export type SyncOutcome = {
  profile: 'created' | 'updated' | 'withdrawn' | 'none';
  teamId: number | null;
};

/** The account and profile side of one onboarding submission. Exported for the tests of the flow. */
export async function applyMemberAnswers(
  req: PayloadRequest,
  userId: number,
  answers: MemberAnswers,
): Promise<SyncOutcome> {
  const { payload } = req;
  const account = (await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
    req,
  })) as unknown as Account;

  // The account: what the form asked, as answered (an emptied answer clears it).
  if (answers.present.has('githubUsername') && (account.githubUsername ?? null) !== answers.githubUsername) {
    await payload.update({
      collection: 'users',
      id: userId,
      data: { githubUsername: answers.githubUsername },
      overrideAccess: true,
      req,
    });
  }

  const linkedId = idOf(account.teamProfile);
  const existing = linkedId
    ? ((await payload
        .findByID({ collection: 'team', id: linkedId, depth: 0, locale: 'en', overrideAccess: true, req })
        .catch(() => null)) as TeamDoc | null)
    : null;

  if (!answers.profilePublic) {
    // No consent (or no longer): nothing public, no photo.
    if (existing && (existing.published !== false || existing.image != null)) {
      await payload.update({
        collection: 'team',
        id: existing.id,
        data: { published: false, image: null },
        overrideAccess: true,
        req,
      });
    }
    await removeUnusedPhotos(payload, userId, null, req);
    return { profile: existing ? 'withdrawn' : 'none', teamId: existing?.id ?? null };
  }

  const name = profileName(answers, account);
  // No new photo sent: the profile keeps the one it has.
  const image = answers.photo ?? idOf(existing?.image);
  const shared = { name, links: profileLinks(existing?.links, answers), image, published: false };

  let teamId: number;
  let outcome: SyncOutcome['profile'];
  if (existing) {
    teamId = existing.id;
    outcome = 'updated';
    await payload.update({
      collection: 'team',
      id: teamId,
      data: { ...shared, bio: answers.bio },
      locale: 'en',
      overrideAccess: true,
      req,
    });
  } else {
    outcome = 'created';
    const created = await payload.create({
      collection: 'team',
      data: { ...shared, bio: answers.bio, role: PLACEHOLDER_TITLE.en, category: 'member' },
      locale: 'en',
      overrideAccess: true,
      req,
    });
    teamId = created.id as number;
  }

  // German: the same bio (the member wrote one), and a title of its own only
  // while there is none (a new profile's placeholder; the board's title is
  // left alone).
  const german = (await payload.findByID({
    collection: 'team',
    id: teamId,
    depth: 0,
    locale: 'de',
    fallbackLocale: false,
    overrideAccess: true,
    req,
  })) as { role?: string | null };
  const englishRole = existing?.role || PLACEHOLDER_TITLE.en;
  await payload.update({
    collection: 'team',
    id: teamId,
    data: {
      bio: answers.bio,
      ...(german.role ? {} : { role: existing ? englishRole : PLACEHOLDER_TITLE.de }),
    },
    locale: 'de',
    overrideAccess: true,
    req,
  });

  if (linkedId !== teamId) {
    await payload.update({ collection: 'users', id: userId, data: { teamProfile: teamId }, overrideAccess: true, req });
  }
  await removeUnusedPhotos(payload, userId, image, req);
  return { profile: outcome, teamId };
}

/** 3. After an onboarding submission is stored. */
export const syncOnboardingSubmission: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc;
  const formId = idOf((doc as { form?: unknown }).form);
  if (formId === null || formId !== (await onboardingFormId(req.payload, req))) return doc;
  const userId = idOf((doc as { submittedBy?: unknown }).submittedBy);
  if (userId === null) return doc;

  const { answers } = readMemberAnswers((doc as { submissionData?: unknown }).submissionData);
  const outcome = await applyMemberAnswers(req, userId, answers);
  req.payload.logger.info(
    `[onboarding] form ${String((doc as { id?: unknown }).id)} from user ${userId}: profile ${outcome.profile}${outcome.teamId ? ` (team ${outcome.teamId})` : ''}`,
  );

  // Mails never fail the member's request (notify.ts catches everything).
  await notifyFormReceived(req, userId, outcome);
  await notifyIfStepsDone(req, userId);
  return doc;
};
