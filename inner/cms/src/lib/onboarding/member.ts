import type { PayloadRequest } from 'payload';
import { roleOf } from '../../access/roles';
import { ownStepsDone } from './progress';
import { currentChecks, currentDocuments } from './store';
import type { MemberDocument, MemberFormDoc, MemberOnboardingView, MemberTodo } from './types';

/**
 * A member's own onboarding page (MemberOnboardingView, types.ts), put
 * together for exactly one account: the caller's (endpoints/onboardingMember.ts)
 * or the one notify.ts asks about. Reads with overrideAccess, so it must
 * never be handed an id the caller chose.
 */

type Row = { id?: string | null; text?: string | null; linkUrl?: string | null; linkLabel?: string | null };
type DocRow = { id?: string | null; title?: string | null; description?: string | null };
type Global = { intro?: string | null; form?: unknown; memberTodos?: Row[] | null; documents?: DocRow[] | null };

const idOf = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === 'object') return idOf((v as { id?: unknown }).id);
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

/** DocuSeal is set up on this server (work package 4 uses the same variables). */
export const docusealConfigured = (): boolean =>
  Boolean(process.env.DOCUSEAL_URL?.trim() && process.env.DOCUSEAL_API_KEY?.trim());

/** Field types whose answer can be offered again as a starting point. Never ticks, never uploads. */
const PREFILL = new Set(['text', 'textarea', 'email', 'number', 'select']);

export async function memberView(req: PayloadRequest, userId: number, locale: 'en' | 'de'): Promise<MemberOnboardingView> {
  const { payload } = req;
  const [account, global] = await Promise.all([
    payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true, req }) as Promise<
      unknown
    > as Promise<{
      id: number;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
      role?: string | null;
      teamProfile?: unknown;
    }>,
    payload.findGlobal({ slug: 'onboarding', depth: 0, locale, overrideAccess: true, req }) as Promise<unknown> as Promise<Global>,
  ]);

  const formId = idOf(global.form);
  const teamId = idOf(account.teamProfile);
  const [form, last, checks, started, team] = await Promise.all([
    formId
      ? // With the caller's rights: a linked form's notification settings
        // (`emails`, editors only) stay out for a member.
        payload.findByID({ collection: 'forms', id: formId, depth: 1, locale, overrideAccess: false, req }).catch(() => null)
      : null,
    formId
      ? payload.find({
          collection: 'form-submissions',
          where: { and: [{ form: { equals: formId } }, { submittedBy: { equals: userId } }] },
          depth: 0,
          limit: 1,
          sort: '-createdAt',
          select: { createdAt: true, submissionData: true },
          overrideAccess: true,
          req,
        })
      : null,
    currentChecks(payload, [userId]),
    currentDocuments(payload, [userId]),
    teamId
      ? payload
          .findByID({ collection: 'team', id: teamId, depth: 0, select: { published: true, image: true }, overrideAccess: true, req })
          .catch(() => null)
      : null,
  ]);

  const todos: MemberTodo[] = (global.memberTodos ?? [])
    .filter((r): r is Row & { id: string; text: string } => Boolean(r.id && r.text?.trim()))
    .map((r) => {
      const c = checks.find((x) => x.kind === 'member' && x.item === r.id);
      return {
        id: r.id,
        text: r.text.trim(),
        linkUrl: r.linkUrl?.trim() || null,
        linkLabel: r.linkLabel?.trim() || null,
        done: Boolean(c?.done),
        at: c?.at ?? null,
      };
    });

  const documents: MemberDocument[] = (global.documents ?? [])
    .filter((d): d is DocRow & { id: string; title: string } => Boolean(d.id && d.title?.trim()))
    .map((d) => {
      const s = started.find((x) => x.item === d.id);
      return {
        id: d.id,
        title: d.title.trim(),
        description: d.description?.trim() || null,
        status: s?.status ?? 'not_started',
        startedAt: s?.startedAt ?? null,
        completedAt: s?.completedAt ?? null,
      };
    });

  const lastDoc = (last?.docs?.[0] ?? null) as { createdAt: string; submissionData?: { field: string; value: unknown }[] } | null;
  let formView: MemberOnboardingView['form'] = null;
  if (form) {
    const f = form as unknown as {
      id: number;
      title: string;
      fields?: { blockType: string; name?: string }[] | null;
      submitButtonLabel?: string | null;
      confirmationMessage?: unknown;
    };
    // Only what the page renders: the form's notification settings (`emails`)
    // are the editors' business.
    const doc: MemberFormDoc = {
      id: f.id,
      title: f.title,
      fields: f.fields ?? [],
      submitButtonLabel: f.submitButtonLabel ?? null,
      confirmationMessage: f.confirmationMessage ?? null,
    };
    let previous: Record<string, string> | null = null;
    if (lastDoc) {
      const prefillable = new Set((f.fields ?? []).filter((b) => b.name && PREFILL.has(b.blockType)).map((b) => b.name as string));
      previous = {};
      for (const row of lastDoc.submissionData ?? []) {
        if (prefillable.has(row.field) && row.value != null && String(row.value) !== '') previous[row.field] = String(row.value);
      }
    }
    formView = { doc, sentAt: lastDoc?.createdAt ?? null, previous };
  }

  const configured = docusealConfigured();
  const teamDoc = team as { published?: boolean | null; image?: unknown } | null;
  return {
    locale,
    member: {
      id: account.id,
      email: account.email,
      firstName: account.firstName ?? '',
      lastName: account.lastName ?? '',
      role: roleOf({ ...account, collection: 'users' }) ?? 'member',
    },
    intro: global.intro?.trim() ?? '',
    form: formView,
    todos,
    documents: { configured, items: documents },
    profile: teamDoc ? { published: teamDoc.published !== false, hasPhoto: teamDoc.image != null } : null,
    stepsDone: ownStepsDone({
      formConfigured: formId !== null,
      formSubmittedAt: lastDoc?.createdAt ?? null,
      todos,
      documents,
      docusealConfigured: configured,
    }),
  };
}
