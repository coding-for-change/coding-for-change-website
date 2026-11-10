import type { Endpoint, PayloadRequest } from 'payload';
import { roleOf } from '../access/roles';
import { parseWebhookEvent, secretMatches, WEBHOOK_SECRET_HEADER, webhookSecret } from '../lib/onboarding/docuseal';
import { applyWebhookEvent, startDocument, syncDocuments } from '../lib/onboarding/documents';
import { docusealConfigured, memberView } from '../lib/onboarding/member';
import { requireAdmin } from './util';

/**
 * The onboarding documents, signed through the association's own DocuSeal
 * (lib/onboarding/documents.ts). Without DOCUSEAL_URL and DOCUSEAL_API_KEY
 * every one of these answers 503 and the member's page shows no documents.
 *
 * The member (any signed-in account, always their own documents only, like
 * endpoints/onboardingMember.ts):
 *
 *   POST /api/onboarding/documents/:item/start   { locale? }
 *        → { url, view: MemberOnboardingView }   the signing link, to open in a new tab
 *          409 { error: "completed" }            already signed
 *          503 / 502 { error }                   DocuSeal down / refused; nothing stored
 *   POST /api/onboarding/documents/refresh       { locale? }
 *        → MemberOnboardingView, after reading their open documents from
 *          DocuSeal (at most once per REFRESH_SECONDS per account; otherwise
 *          just the stored state)
 *
 * DocuSeal:
 *
 *   POST /api/onboarding/docuseal-webhook
 *        The header X-Webhook-Secret must be DOCUSEAL_WEBHOOK_SECRET (compared
 *        in constant time); without that variable every call is refused.
 *        → 200 { result } for every event it understands, also the ones it
 *          ignores, so DocuSeal does not retry them.
 *
 * The board (admins):
 *
 *   POST /api/onboarding/admin/documents/resync  { user }
 *        → { results: [{ item, status, error? }] }  reads that member's
 *          documents from DocuSeal again, for when webhooks got lost.
 */

const NO_STORE = { 'Cache-Control': 'no-store, private' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });
const fail = (status: number, error: string) => json({ error }, status);

const REFRESH_SECONDS = 15;
const MAX_WEBHOOK_BYTES = 2 * 1024 * 1024;

function selfOf(req: PayloadRequest): number | null {
  if (roleOf(req.user) === null) return null;
  const id = Number(req.user?.id);
  return Number.isInteger(id) ? id : null;
}

const localeOf = (v: unknown): 'en' | 'de' => (v === 'de' ? 'de' : 'en');

async function readBody(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    const b = (await req.json?.()) as unknown;
    return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

type DocRow = { id?: string | null; title?: string | null; docusealTemplateId?: number | null };

// ---- member: start --------------------------------------------------------------

const start: Endpoint = {
  path: '/onboarding/documents/:item/start',
  method: 'post',
  handler: async (req) => {
    const self = selfOf(req);
    if (self === null) return fail(401, 'Please sign in.');
    if (!docusealConfigured()) return fail(503, 'unconfigured');
    const item = String(req.routeParams?.item ?? '');
    const body = await readBody(req);
    const locale = localeOf(body.locale ?? req.searchParams.get('locale'));
    const { payload } = req;

    const global = (await payload.findGlobal({ slug: 'onboarding', depth: 0, locale, overrideAccess: true, req })) as {
      documents?: DocRow[] | null;
    };
    const doc = (global.documents ?? []).find((d) => d.id === item && d.title?.trim());
    const templateId = Number(doc?.docusealTemplateId);
    if (!doc || !Number.isSafeInteger(templateId) || templateId <= 0) return fail(404, 'No such document (any more). Reload the page.');

    const account = (await payload.findByID({ collection: 'users', id: self, depth: 0, overrideAccess: true, req })) as {
      email: string;
      firstName?: string | null;
      lastName?: string | null;
    };
    const outcome = await startDocument(payload, {
      user: self,
      item,
      title: doc.title!.trim(),
      templateId,
      name: [account.firstName, account.lastName].filter(Boolean).join(' ').trim() || account.email,
      email: account.email,
    });
    if (!outcome.ok) return fail(outcome.status, outcome.error);
    return json({ url: outcome.url, view: await memberView(req, self, locale) }, outcome.created ? 201 : 200);
  },
};

// ---- member: refresh --------------------------------------------------------------

const lastRefresh = new Map<number, number>();

const refresh: Endpoint = {
  path: '/onboarding/documents/refresh',
  method: 'post',
  handler: async (req) => {
    const self = selfOf(req);
    if (self === null) return fail(401, 'Please sign in.');
    const body = await readBody(req);
    const locale = localeOf(body.locale ?? req.searchParams.get('locale'));
    if (docusealConfigured()) {
      const now = Date.now();
      if (now - (lastRefresh.get(self) ?? 0) >= REFRESH_SECONDS * 1000) {
        lastRefresh.set(self, now);
        // Errors are in the results; the member just sees the stored state then.
        await syncDocuments(req, self);
      }
    }
    return json(await memberView(req, self, locale));
  },
};

// ---- DocuSeal: webhook ------------------------------------------------------------

const webhook: Endpoint = {
  path: '/onboarding/docuseal-webhook',
  method: 'post',
  handler: async (req) => {
    const { payload } = req;
    const secret = webhookSecret();
    if (!secret) {
      payload.logger.warn('[onboarding] DocuSeal webhook refused: DOCUSEAL_WEBHOOK_SECRET is not set (or shorter than 24 characters)');
      return fail(503, 'Webhook not configured.');
    }
    if (!secretMatches(secret, req.headers.get(WEBHOOK_SECRET_HEADER))) {
      payload.logger.warn('[onboarding] DocuSeal webhook refused: wrong or missing secret header');
      return fail(401, 'Unauthorized.');
    }
    const length = Number(req.headers.get('content-length') ?? 0);
    if (Number.isFinite(length) && length > MAX_WEBHOOK_BYTES) return fail(413, 'Too large.');
    let body: unknown;
    try {
      body = await req.json?.();
    } catch {
      return fail(400, 'Invalid JSON.');
    }
    const event = parseWebhookEvent(body);
    if (!event) return fail(400, 'Not a DocuSeal event.');
    const outcome = await applyWebhookEvent(req, event);
    return json(outcome);
  },
};

// ---- board: resync ----------------------------------------------------------------

const resync: Endpoint = {
  path: '/onboarding/admin/documents/resync',
  method: 'post',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    if (!docusealConfigured()) return fail(503, 'DocuSeal is not configured on this server.');
    const body = await readBody(req);
    const user = Number(body.user);
    if (!Number.isInteger(user)) return fail(400, 'Expected { user: id }.');
    const exists = await req.payload.findByID({ collection: 'users', id: user, depth: 0, req }).catch(() => null);
    if (!exists) return fail(404, 'No such account.');
    return json({ results: await syncDocuments(req, user) });
  },
};

export const onboardingDocumentEndpoints: Endpoint[] = [start, refresh, webhook, resync];
