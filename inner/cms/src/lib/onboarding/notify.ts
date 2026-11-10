import type { Payload, PayloadRequest } from 'payload';
import { siteOrigin } from '../mediaUpload';
import { buildWaitlistEmail } from '../waitlistEmailTemplate';
import { memberView } from './member';
import type { SyncOutcome } from './sync';

/**
 * Mails to the board (every `users` account with role admin) about a
 * member's onboarding:
 *
 * - `notifyFormReceived`: the member sent the onboarding form (each time).
 * - `notifyIfStepsDone`: the member has done all of their own steps (form,
 *   to-dos, documents with DocuSeal; progress.ts `ownStepsDone`). Once per
 *   member: `users.stepsCompletedAt` records it, and a member who unticks and
 *   ticks again does not mail the board twice. Called after a form and after
 *   a to-do tick; work package 4 calls it after a document is completed.
 *
 * In the branded frame of the other mails (waitlistEmailTemplate.ts), in
 * English (the board's working language in the CMS). A mail that fails is
 * logged and nothing else: it never fails the member's request.
 */

const CONTACT = process.env.CONTACT_TO_EMAIL || 'info@codingforchange.com';

type Account = { id: number; email: string; firstName?: string | null; lastName?: string | null; stepsCompletedAt?: string | null };

async function adminAddresses(payload: Payload, req?: PayloadRequest): Promise<string[]> {
  const found = await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    depth: 0,
    pagination: false,
    select: { email: true },
    overrideAccess: true,
    req,
  });
  return [...new Set(found.docs.map((d) => String((d as { email?: string }).email ?? '').trim()).filter(Boolean))];
}

const nameOf = (a: Account) => [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || a.email;

async function account(payload: Payload, id: number, req?: PayloadRequest): Promise<Account> {
  return (await payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true, req })) as unknown as Account;
}

async function send(payload: Payload, subject: string, message: string, req?: PayloadRequest): Promise<void> {
  const to = await adminAddresses(payload, req);
  if (to.length === 0) {
    payload.logger.warn(`[onboarding] no admin to tell: "${subject}"`);
    return;
  }
  const origin = siteOrigin();
  const mail = buildWaitlistEmail({
    message,
    contactEmail: CONTACT,
    audience: 'board',
    siteOrigin: origin,
    lang: 'en',
    ctaLabel: 'Open the onboarding dashboard',
    ctaUrl: `${origin}/admin/onboarding`,
  });
  await payload.sendEmail({ to, subject, html: mail.html, text: mail.text });
  payload.logger.info(`[onboarding] mail to ${to.length} admin(s): "${subject}"`);
}

const PROFILE_LINE: Record<SyncOutcome['profile'], string> = {
  created: 'They agreed to a public profile: a draft is waiting on the Team page, unpublished. Set their title and project in the dashboard and publish it.',
  updated: 'They agreed to a public profile and changed it: it is unpublished again until you publish it in the dashboard.',
  withdrawn:
    'They took back their consent to a public profile: it is unpublished now and their photo is deleted. If it should go entirely, delete it under Team.',
  none: 'They did not agree to a public profile, so none was made.',
};

export async function notifyFormReceived(req: PayloadRequest, userId: number, outcome: SyncOutcome): Promise<void> {
  try {
    const a = await account(req.payload, userId, req);
    const name = nameOf(a);
    await send(
      req.payload,
      `Onboarding: ${name} sent the form`,
      `${name} (${a.email}) sent the onboarding form.\n\n${PROFILE_LINE[outcome.profile]}\n\nTheir answers are under Form Submissions.`,
      req,
    );
  } catch (err) {
    req.payload.logger.error(`[onboarding] form mail for user ${userId} failed: ${(err as Error)?.message ?? err}`);
  }
}

/** Mail the board once when the member's own steps are all done. Never throws. */
export async function notifyIfStepsDone(req: PayloadRequest, userId: number): Promise<void> {
  try {
    const { payload } = req;
    const a = await account(payload, userId, req);
    if (a.stepsCompletedAt) return;
    const view = await memberView(req, userId, 'en');
    if (!view.stepsDone) return;
    await payload.update({
      collection: 'users',
      id: userId,
      data: { stepsCompletedAt: new Date().toISOString() },
      overrideAccess: true,
      req,
    });
    const name = nameOf(a);
    await send(
      payload,
      `Onboarding: ${name} has done all their steps`,
      `${name} (${a.email}) has done everything on their onboarding page: the form, their to-dos${view.documents.configured && view.documents.items.length ? ' and their documents' : ''}.\n\nWhat is left are the board's to-dos for them in the dashboard.`,
      req,
    );
  } catch (err) {
    req.payload.logger.error(`[onboarding] all-done mail for user ${userId} failed: ${(err as Error)?.message ?? err}`);
  }
}
