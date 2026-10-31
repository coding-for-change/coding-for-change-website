import type { Endpoint, PayloadRequest } from 'payload';
import { change, eveningStates, type EveningState } from '../lib/manage/store';
import { techTourFormId } from '../lib/retention';
import { requireAdmin } from './util';

/**
 * The evenings TechTour registrants gave up through their own link
 * (/techtour/manage, lib/manage/store.ts), for the review workspace. Admins
 * only:
 *
 *   GET  /api/techtour/withdrawals                                 { evenings: { [registration id]: { [evening key]: { withdrawn, at, by } } } }
 *   POST /api/techtour/withdrawals  { submission, option, withdrawn } { id, option, state }
 *
 * The POST adds an evening back (`withdrawn: false`) – only one the person
 * gave up – or takes back such an add-back (`withdrawn: true`). Giving up an
 * evening the person never gave up stays theirs. Each is a new row with the
 * admin's email and the time; nothing is edited or deleted.
 */

const list: Endpoint = {
  path: '/techtour/withdrawals',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const all = await eveningStates(req.payload);
    return Response.json({
      evenings: Object.fromEntries([...all].map(([id, evenings]) => [id, Object.fromEntries(evenings)])),
    });
  },
};

const set: Endpoint = {
  path: '/techtour/withdrawals',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    let body: { submission?: unknown; option?: unknown; withdrawn?: unknown };
    try {
      body = ((await req.json?.()) ?? {}) as typeof body;
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    const id = Number(body.submission);
    const option = typeof body.option === 'string' ? body.option : '';
    if (!Number.isInteger(id) || !option || typeof body.withdrawn !== 'boolean') {
      return Response.json(
        { error: 'Expected { submission: id, option: evening key, withdrawn: true | false }.' },
        { status: 400 },
      );
    }
    const [doc, formId] = await Promise.all([
      req.payload.findByID({ collection: 'form-submissions', id, depth: 0, req }).catch(() => null),
      techTourFormId(req.payload),
    ]);
    const docForm = doc && (typeof doc.form === 'object' && doc.form ? doc.form.id : doc.form);
    if (!doc || formId == null || docForm !== formId) {
      return Response.json({ error: 'No TechTour registration with this id.' }, { status: 404 });
    }
    // Back only what the person gave up; withdrawn again only what we added back.
    const now = (await eveningStates(req.payload, [id])).get(id)?.get(option);
    if (!now || now.withdrawn === body.withdrawn) {
      return Response.json(
        { error: body.withdrawn ? 'This evening was not added back.' : 'This evening was not given up.' },
        { status: 409 },
      );
    }
    const by = String((req.user as { email?: string } | null)?.email ?? 'admin');
    await change(req.payload, id, [option], body.withdrawn, by);
    req.payload.logger.info(
      `[manage] registration ${id}: ${option} ${body.withdrawn ? 'withdrawn again' : 'added back'} by ${by}`,
    );
    const state = (await eveningStates(req.payload, [id])).get(id)?.get(option) as EveningState;
    return Response.json({ id, option, state });
  },
};

export const withdrawalEndpoints: Endpoint[] = [list, set];
