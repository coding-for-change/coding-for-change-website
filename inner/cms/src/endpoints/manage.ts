import type { Endpoint, Payload, PayloadRequest } from 'payload';
import type { OptionRow } from '../lib/choiceKeys';
import { eveningOf, eveningsFieldOf } from '../lib/share/evening';
import {
  MANAGE_UNTIL,
  eveningsOf,
  manageOpen,
  registrationOfToken,
  withdraw,
  withdrawalsOf,
} from '../lib/manage/store';
import { techTourFormId } from '../lib/retention';

/**
 * The personal TechTour link (/techtour/manage?token=… on the site), as the
 * registered person uses it – public, guarded by nothing but the token:
 *
 *   GET  /api/techtour/manage?token=…&locale=de   the name and the evenings registered for
 *   POST /api/techtour/manage                     { token, withdraw: [option…], locale } → the same, updated
 *
 * Evenings can only be given up, never added, and only until MANAGE_UNTIL
 * (lib/manage/store.ts); after that the GET still answers, with `open: false`.
 * The registration itself is only read – a withdrawal goes into its own table.
 * Everything answers `no-store` and `noindex`.
 */

const PRIVATE = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: PRIVATE });

const invalid = () => json({ error: 'invalid' }, 404);

export type ManageEvening = {
  option: string;
  /** The form's label for it, in the page's language ("Di 10. Nov · Lio"). */
  label: string;
  date: string | null;
  company: string | null;
  title: string | null;
  time: string | null;
  location: string | null;
  /** When it was given up through the link; null while still registered. */
  withdrawnAt: string | null;
};

export type ManageView = {
  name: string;
  open: boolean;
  until: string;
  evenings: ManageEvening[];
};

type Block = { blockType: string; name?: string; options?: OptionRow[] | null };

type SubmissionDoc = {
  id: number;
  form: number | { id: number };
  submissionData?: { field: string; value: unknown }[] | null;
  choiceKeys?: Record<string, unknown> | null;
};

const localeOf = (raw: unknown): 'en' | 'de' => (raw === 'de' ? 'de' : 'en');

/** The registration behind a token, with its form's evenings question in both languages. */
async function registrationOf(payload: Payload, token: string) {
  const id = await registrationOfToken(payload, token);
  if (id == null) return null;
  const formId = await techTourFormId(payload);
  if (formId == null) return null;
  const doc = (await payload
    .findByID({ collection: 'form-submissions', id, depth: 0, overrideAccess: true })
    .catch(() => null)) as SubmissionDoc | null;
  const docForm = doc && (typeof doc.form === 'object' && doc.form ? doc.form.id : doc.form);
  if (!doc || docForm !== formId) return null;

  // One locale per call and no shared `req` – see lib/share/registrations.ts.
  const [en, de] = await Promise.all(
    (['en', 'de'] as const).map((locale) =>
      payload.findByID({ collection: 'forms', id: formId, depth: 0, locale }).catch(() => null),
    ),
  );
  const fieldEn = eveningsFieldOf((en?.fields ?? []) as Block[]);
  const fieldDe = eveningsFieldOf((de?.fields ?? []) as Block[]);
  if (!fieldEn?.name) return null;
  const options = { en: fieldEn.options ?? [], de: fieldDe?.options ?? [] };
  const picked = eveningsOf(doc, fieldEn.name, options.en, options.de);
  return { doc, formId, options, picked };
}

async function viewOf(
  payload: Payload,
  found: NonNullable<Awaited<ReturnType<typeof registrationOf>>>,
  locale: 'en' | 'de',
): Promise<ManageView> {
  const { doc, formId, options, picked } = found;
  const answers = new Map((doc.submissionData ?? []).map((kv) => [kv.field, String(kv.value ?? '').trim()]));
  const withdrawn = (await withdrawalsOf(payload, [doc.id])).get(doc.id) ?? new Map<string, string>();
  const labels = new Map(
    [...options.en, ...options[locale]].map((o) => [o.value, o.label?.trim() || o.value]),
  );
  // In the form's (date) order, whatever order they were picked in.
  const order = options.en.map((o) => o.value);
  const keys = [...picked].sort((a, b) => order.indexOf(a) - order.indexOf(b));

  const evenings: ManageEvening[] = [];
  for (const option of keys) {
    const ev = await eveningOf(payload, formId, option, undefined, locale);
    evenings.push({
      option,
      label: labels.get(option) ?? option,
      date: ev?.date ? ev.date.toISOString() : null,
      company: ev?.company ?? null,
      title: ev?.title ?? null,
      time: ev?.time ?? null,
      location: ev?.location ?? null,
      withdrawnAt: withdrawn.get(option) ?? null,
    });
  }
  return {
    name: [answers.get('firstName'), answers.get('lastName')].filter(Boolean).join(' '),
    open: manageOpen(),
    until: MANAGE_UNTIL.toISOString(),
    evenings,
  };
}

const read: Endpoint = {
  path: '/techtour/manage',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const token = String(req.searchParams.get('token') ?? '');
    const found = await registrationOf(req.payload, token);
    if (!found) return invalid();
    return json(await viewOf(req.payload, found, localeOf(req.searchParams.get('locale'))));
  },
};

const update: Endpoint = {
  path: '/techtour/manage',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    let body: { token?: unknown; withdraw?: unknown; locale?: unknown };
    try {
      body = ((await req.json?.()) ?? {}) as typeof body;
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400);
    }
    const found = await registrationOf(req.payload, String(body.token ?? ''));
    if (!found) return invalid();
    if (!manageOpen()) return json({ error: 'closed' }, 403);

    const options = Array.isArray(body.withdraw) ? body.withdraw.map(String) : [];
    // Only evenings this registration was sent with: giving up, never adding.
    if (options.length === 0 || options.length > 20 || !options.every((o) => found.picked.includes(o))) {
      return json({ error: 'Not an evening of this registration.' }, 400);
    }
    await withdraw(req.payload, found.doc.id, options);
    req.payload.logger.info(`[manage] registration ${found.doc.id} withdrew from ${options.join(', ')}`);
    return json(await viewOf(req.payload, found, localeOf(body.locale)));
  },
};

export const manageEndpoints: Endpoint[] = [read, update];
