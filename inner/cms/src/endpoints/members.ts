import type { Endpoint, PayloadRequest } from 'payload';
import { markMember, membersAmong } from '../lib/members';
import { techTourFormId } from '../lib/retention';
import { requireAdmin } from './util';

/**
 * The "Coding for Change member" mark on TechTour registrations (lib/members.ts),
 * for the review workspace. Admins only:
 *
 *   GET  /api/techtour/members                        { ids: [registration id…] }
 *   POST /api/techtour/members  { submission, member } { id, member }
 */

const list: Endpoint = {
  path: '/techtour/members',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    return Response.json({ ids: [...(await membersAmong(req.payload))] });
  },
};

const mark: Endpoint = {
  path: '/techtour/members',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    let body: { submission?: unknown; member?: unknown };
    try {
      body = ((await req.json?.()) ?? {}) as typeof body;
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    const id = Number(body.submission);
    if (!Number.isInteger(id) || typeof body.member !== 'boolean') {
      return Response.json({ error: 'Expected { submission: id, member: true | false }.' }, { status: 400 });
    }
    // Only a TechTour registration can be a member's.
    const [doc, formId] = await Promise.all([
      req.payload.findByID({ collection: 'form-submissions', id, depth: 0, req }).catch(() => null),
      techTourFormId(req.payload),
    ]);
    const docForm = doc && (typeof doc.form === 'object' && doc.form ? doc.form.id : doc.form);
    if (!doc || formId == null || docForm !== formId) {
      return Response.json({ error: 'No TechTour registration with this id.' }, { status: 404 });
    }
    await markMember(req.payload, id, body.member);
    return Response.json({ id, member: body.member });
  },
};

export const memberEndpoints: Endpoint[] = [list, mark];
