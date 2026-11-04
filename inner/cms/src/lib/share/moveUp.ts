import type { Payload } from 'payload';
import { manageUrl } from '../manage/link';
import { tokensFor } from '../manage/store';
import { sendResendBatch } from '../resendBatch';
import { eveningOf } from './evening';
import { buildMoveUpEmail } from './moveUpEmail';
import {
  WAITLIST_BY,
  decide,
  eveningSettings,
  nextOnWaitlist,
  type HostDecisions,
  type SubmissionDoc,
} from './registrations';
import { recordMove } from './store';

/**
 * Moving up from an evening's waitlist on its own: when an admitted person
 * gives the evening up through their own link (endpoints/manage.ts), the
 * first person on its waitlist (lib/share/registrations.ts) is admitted at
 * once – `by: 'waitlist'` – and gets a mail with their own link, so they can
 * give the spot up in turn and the next one moves up.
 *
 * Only while one of the evening's share links says so ("Move up from the
 * waitlist until", collections/ShareLinks.ts): we turn it on once the first
 * acceptance mails have gone out by hand, so nobody moves up before the
 * others even know they are in. Nothing else sends a mail on its own – not
 * the host's decisions, not the waitlist itself.
 *
 * Decisions on the share links, moves on a waitlist and moving up all take
 * turns (`inTurn`): the CMS is one process, and a registration's decisions
 * for all its evenings live in one field – two writes at once could lose one.
 * Only the writes take turns: the mail goes out afterwards, so a slow mail
 * server never holds up a host's clicks.
 */

let queue: Promise<unknown> = Promise.resolve();

/** Runs `fn` after every earlier one has finished, one at a time. */
export function inTurn<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

const FROM = () =>
  `${process.env.EMAIL_FROM_NAME || 'Coding for Change'} <${process.env.EMAIL_FROM || 'noreply@codingforchange.com'}>`;
const SITE_ORIGIN = () => (process.env.PUBLIC_SITE_ORIGIN || 'https://codingforchange.com').replace(/\/+$/, '');
const CONTACT = () => process.env.CONTACT_TO_EMAIL || 'info@codingforchange.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * After a withdrawal through the link: for every evening the person had been
 * admitted to (`before`, their decisions as they were), let the next one move
 * up. Never throws – the withdrawal stands either way.
 */
export async function afterWithdrawal(
  payload: Payload,
  id: number,
  options: string[],
  before: HostDecisions | null | undefined,
): Promise<void> {
  for (const option of options) {
    if (before?.[option]?.decision !== 'admitted') continue;
    try {
      const next = await inTurn(() => moveUp(payload, option, id));
      if (!next) continue;
      const mail = await tellMovedUp(payload, next, option);
      await recordMove(payload, next.id, option, mail.status, mail.error);
    } catch (err) {
      payload.logger.error(err, `[waitlist] ${option}: moving up after registration ${id} withdrew failed`);
    }
  }
}

/** Admit the first on the evening's waitlist, if moving up is on; the one admitted, or null. */
async function moveUp(payload: Payload, option: string, freedBy: number): Promise<SubmissionDoc | null> {
  const settings = await eveningSettings(payload, option);
  if (!settings.moveUpUntil || settings.moveUpUntil.getTime() <= Date.now()) {
    payload.logger.info(`[waitlist] ${option}: registration ${freedBy} freed a spot – moving up is off, it stays open`);
    return null;
  }
  const link = settings.links[0];
  const next = await nextOnWaitlist(payload, link);
  if (!next) {
    payload.logger.info(`[waitlist] ${option}: registration ${freedBy} freed a spot – nobody on the waitlist`);
    return null;
  }
  if (!(await decide(payload, link, next.id, 'admitted', WAITLIST_BY))) return null;
  payload.logger.info(`[waitlist] ${option}: registration ${next.id} moved up for ${freedBy}`);
  return next;
}

/** The mail to the one who moved up; never throws. */
async function tellMovedUp(
  payload: Payload,
  doc: SubmissionDoc,
  option: string,
): Promise<{ status: 'sent' | 'failed' | 'no-address'; error: string | null }> {
  const answers = new Map((doc.submissionData ?? []).map((kv) => [kv.field.toLowerCase(), String(kv.value ?? '').trim()]));
  const to = answers.get('email') ?? '';
  if (!EMAIL_RE.test(to)) return { status: 'no-address', error: null };
  try {
    const lang = doc.language === 'de' ? 'de' : 'en';
    const formId = typeof doc.form === 'object' && doc.form ? doc.form.id : doc.form;
    const [evening, tokens] = await Promise.all([
      eveningOf(payload, formId, option, undefined, lang),
      tokensFor(payload, [doc.id]),
    ]);
    const token = tokens.get(doc.id);
    if (!evening || !token) return { status: 'failed', error: 'evening or link not found' };
    const mail = buildMoveUpEmail({
      lang,
      firstName: answers.get('firstname') ?? '',
      evening: {
        // "Mon 9 Nov · Project A" → "Project A" when the TechTour page has no company yet.
        name: evening.company || evening.label.split(' · ').slice(1).join(' · ') || evening.label,
        date: evening.date,
        time: evening.time,
        location: evening.location,
        title: evening.title,
      },
      manageLink: manageUrl(SITE_ORIGIN(), token),
      siteOrigin: SITE_ORIGIN(),
      contactEmail: CONTACT(),
    });
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const [result] = await sendResendBatch(
        apiKey,
        [{ from: FROM(), to: [to], reply_to: CONTACT(), subject: mail.subject, html: mail.html, text: mail.text }],
        `waitlist-${option}-${doc.id}-${Date.now()}`,
      );
      return result?.error ? { status: 'failed', error: result.error } : { status: 'sent', error: null };
    }
    // A dev server without a key: the console adapter logs it.
    await payload.sendEmail({ from: FROM(), to, replyTo: CONTACT(), subject: mail.subject, html: mail.html, text: mail.text });
    return { status: 'sent', error: null };
  } catch (err) {
    payload.logger.error(err, `[waitlist] could not tell registration ${doc.id} it moved up`);
    return { status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}
