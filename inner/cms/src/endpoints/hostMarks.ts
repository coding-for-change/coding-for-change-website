import type { Endpoint, PayloadRequest } from 'payload';
import { allScores, movesOf } from '../lib/share/store';
import { requireAdmin } from './util';

/**
 * What the hosts did besides their decisions, for the review workspace.
 * Admins only:
 *
 *   GET /api/techtour/host-marks   { scores: { [registration id]: { [evening key]: 1–10 } },
 *                                    moves:  { [registration id]: { [evening key]: { at, mailStatus, mailError } } } }
 *
 * `scores`: each host's rating on its share link (lib/share/store.ts).
 * `moves`: who moved up from an evening's waitlist on their own, and whether
 * the mail telling them went out (lib/share/moveUp.ts).
 */

const toJson = <T,>(m: Map<number, Map<string, T>>) =>
  Object.fromEntries([...m].map(([id, byOption]) => [id, Object.fromEntries(byOption)]));

const list: Endpoint = {
  path: '/techtour/host-marks',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const [scores, moves] = await Promise.all([allScores(req.payload), movesOf(req.payload)]);
    return Response.json({ scores: toJson(scores), moves: toJson(moves) });
  },
};

export const hostMarkEndpoints: Endpoint[] = [list];
