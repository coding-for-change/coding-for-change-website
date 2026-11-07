import type { Endpoint, PayloadRequest } from 'payload';
import { isApplicationStage } from '../lib/stageOptions';
import { currentStages, setStage } from '../lib/stages';
import { requireAdmin } from './util';

/**
 * Where membership applications stand after the review (lib/stages.ts), for
 * the review workspace. Admins only:
 *
 *   GET  /api/applications/stages                         { stages: { [application id]: stage } }
 *   POST /api/applications/stages  { submission, stage }  { id, stage }   (stage null = clear)
 */

const list: Endpoint = {
  path: '/applications/stages',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    return Response.json({ stages: Object.fromEntries(await currentStages(req.payload)) });
  },
};

const set: Endpoint = {
  path: '/applications/stages',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    let body: { submission?: unknown; stage?: unknown };
    try {
      body = ((await req.json?.()) ?? {}) as typeof body;
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    const id = Number(body.submission);
    const stage = body.stage === null ? null : body.stage;
    if (!Number.isInteger(id) || (stage !== null && !isApplicationStage(stage))) {
      return Response.json(
        { error: 'Expected { submission: id, stage: "interviewed" | "admitted" | "not_admitted" | "withdrew" | null }.' },
        { status: 400 },
      );
    }
    // Only a membership application (the form titled "application") has a stage.
    const doc = await req.payload
      .findByID({ collection: 'form-submissions', id, depth: 1, req })
      .catch(() => null);
    const form = doc && typeof doc.form === 'object' ? doc.form : null;
    if (!form || form.title?.trim().toLowerCase() !== 'application') {
      return Response.json({ error: 'No membership application with this id.' }, { status: 404 });
    }
    const by = String((req.user as { email?: string } | null)?.email ?? 'admin');
    await setStage(req.payload, id, stage, by);
    return Response.json({ id, stage });
  },
};

export const stageEndpoints: Endpoint[] = [list, set];
