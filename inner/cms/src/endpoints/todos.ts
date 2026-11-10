import type { Endpoint, PayloadRequest } from 'payload';
import { confirmationsOf } from '../lib/manage/confirmations';
import { withdrawalsOf } from '../lib/manage/store';
import { techTourFormId } from '../lib/retention';
import { eveningOf, eveningsFieldOf } from '../lib/share/evening';
import type { HostDecisions } from '../lib/share/registrations';
import { requireAdmin } from './util';

/**
 * Where the people admitted to a TechTour evening stand with its to-dos
 * (TechTour → Company visits → To-dos, ticked on /techtour/manage) – above
 * all, who has not ticked one yet. Admins only:
 *
 *   GET /api/techtour/todos
 *     { evenings: [{ option, label, date, company, todos: [{ id, text }],
 *                    people: [{ id, name, email, done: { [todo id]: ticked at | null } }] }] }
 *
 * Only evenings that have to-dos, and only people the host admitted who have
 * not given the evening up – the ones the to-dos are shown to.
 */

type Doc = {
  id: number;
  submissionData?: { field: string; value: unknown }[] | null;
  hostDecisions?: HostDecisions | null;
};

const list: Endpoint = {
  path: '/techtour/todos',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const { payload } = req;
    const formId = await techTourFormId(payload);
    if (formId == null) return Response.json({ evenings: [] });

    const form = await payload.findByID({ collection: 'forms', id: formId, depth: 0, locale: 'en' }).catch(() => null);
    const options = eveningsFieldOf(form?.fields as Parameters<typeof eveningsFieldOf>[0])?.options ?? [];
    const { docs } = await payload.find({
      collection: 'form-submissions',
      where: { form: { equals: formId } },
      depth: 0,
      pagination: false,
    });
    const subs = docs as unknown as Doc[];
    const ids = subs.map((s) => s.id);
    const [withdrawals, confirmations] = await Promise.all([withdrawalsOf(payload, ids), confirmationsOf(payload, ids)]);

    const evenings = [];
    for (const o of options) {
      const ev = await eveningOf(payload, formId, o.value);
      if (!ev?.todos.length) continue;
      const people = subs
        .filter((s) => s.hostDecisions?.[o.value]?.decision === 'admitted' && !withdrawals.get(s.id)?.has(o.value))
        .map((s) => {
          const answers = new Map((s.submissionData ?? []).map((kv) => [kv.field, String(kv.value ?? '').trim()]));
          const ticked = new Map(
            (confirmations.get(s.id) ?? []).filter((c) => c.option === o.value).map((c) => [c.todo, c.at]),
          );
          return {
            id: s.id,
            name: [answers.get('firstName'), answers.get('lastName')].filter(Boolean).join(' '),
            email: answers.get('email') ?? '',
            done: Object.fromEntries(ev.todos.map((t) => [t.id, ticked.get(t.id) ?? null])),
          };
        });
      evenings.push({
        option: o.value,
        label: ev.label,
        date: ev.date ? ev.date.toISOString() : null,
        company: ev.company,
        todos: ev.todos.map((t) => ({ id: t.id, text: t.text })),
        people,
      });
    }
    return Response.json({ evenings });
  },
};

export const todoEndpoints: Endpoint[] = [list];
