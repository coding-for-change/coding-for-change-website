import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres';

/**
 * Data, no schema: the departments of the redesigned /team page (team-groups)
 * and who looks after what in each (teamMemberships), as agreed with the board
 * on 2026-11-21. Also publishes Niklas's profile, which waited unpublished for
 * the new page.
 *
 * People are matched by id *and* first name, so on any other database (a fresh
 * dev DB, a restored backup) whoever is not that person is skipped instead of
 * getting someone else's topic. A department that already exists under the
 * same English name is reused, and anyone who already has memberships keeps
 * them. A person that cannot be saved is logged and skipped: a data problem
 * must not stop the CMS from booting (migrations run before `pnpm start`).
 */

const DEPARTMENTS = [
  { key: 'partnerships', order: 20, en: 'Events & Partnerships', de: 'Events & Partnerships' },
  { key: 'projects', order: 30, en: 'Projects', de: 'Projekte' },
  { key: 'community', order: 40, en: 'Community', de: 'Community' },
  { key: 'marketing', order: 50, en: 'Marketing', de: 'Marketing' },
  { key: 'operations', order: 60, en: 'Operations', de: 'Operations' },
] as const;

type Key = (typeof DEPARTMENTS)[number]['key'];

/** [team id, first name, department, topic (en), topic (de)] */
const PEOPLE: [number, string, Key, string, string][] = [
  [17, 'Tom', 'partnerships', 'Lead · Quants', 'Leitung · Quants'],
  [21, 'Louis', 'partnerships', 'Big Tech', 'Big Tech'],
  [16, 'Tien', 'partnerships', 'Consulting', 'Consulting'],
  [28, 'Alicia', 'partnerships', 'Start-ups & VCs', 'Start-ups & VCs'],
  [4, 'Tim', 'projects', 'Project success', 'Project Success'],
  [10, 'Richard', 'projects', 'Project lead', 'Projektleitung'],
  [14, 'Luis', 'projects', 'Project lead', 'Projektleitung'],
  [15, 'Genci', 'projects', 'Project lead', 'Projektleitung'],
  [26, 'Flavio', 'projects', 'Project lead', 'Projektleitung'],
  [1, 'David', 'community', 'Lead', 'Leitung'],
  [27, 'Fabian', 'community', 'Company events', 'Company Events'],
  [38, 'Niklas', 'community', 'Special events', 'Special Events'],
  [25, 'Max', 'community', 'Community events', 'Community Events'],
  [6, 'Alex', 'marketing', 'Lead', 'Leitung'],
  [24, 'Constantin', 'marketing', 'Content', 'Content'],
  [2, 'Jakob', 'operations', 'Lead', 'Leitung'],
];

const NIKLAS = 38;

const log = (payload: MigrateUpArgs['payload'], msg: string) => payload.logger.info(`[team departments] ${msg}`);

/** The profile with this id, if it belongs to the person with this first name. */
async function person({ payload, req }: MigrateUpArgs, id: number, first: string) {
  const doc = await payload.findByID({ collection: 'team', id, depth: 0, locale: 'en', disableErrors: true, req });
  return doc && doc.name.trim().split(/\s+/)[0] === first ? doc : null;
}

export async function up(args: MigrateUpArgs): Promise<void> {
  const { payload, req } = args;

  const ids = {} as Record<Key, number>;
  for (const d of DEPARTMENTS) {
    const found = await payload.find({
      collection: 'team-groups',
      where: { name: { equals: d.en } },
      locale: 'en',
      limit: 1,
      depth: 0,
      req,
    });
    if (found.docs[0]) {
      ids[d.key] = found.docs[0].id;
      continue;
    }
    const created = await payload.create({
      collection: 'team-groups',
      data: { name: d.en, order: d.order },
      locale: 'en',
      depth: 0,
      req,
    });
    await payload.update({ collection: 'team-groups', id: created.id, data: { name: d.de }, locale: 'de', depth: 0, req });
    ids[d.key] = created.id;
  }

  let assigned = 0;
  for (const [id, first, key, en, de] of PEOPLE) {
    const doc = await person(args, id, first);
    if (!doc) {
      log(payload, `skipped ${first} (#${id}): not on this database`);
      continue;
    }
    if ((doc.teamMemberships ?? []).length > 0) {
      log(payload, `skipped ${first} (#${id}): already in a department`);
      continue;
    }
    try {
      // The array is shared by both languages, the topic is not: English
      // first (the row gets its id), then German on the same row.
      const saved = await payload.update({
        collection: 'team',
        id,
        data: { teamMemberships: [{ team: ids[key], role: en }] },
        locale: 'en',
        depth: 0,
        req,
      });
      const row = saved.teamMemberships?.[0]?.id;
      await payload.update({
        collection: 'team',
        id,
        data: { teamMemberships: [{ id: row, team: ids[key], role: de }] },
        locale: 'de',
        depth: 0,
        req,
      });
      assigned += 1;
    } catch (err) {
      payload.logger.warn(`[team departments] could not assign ${first} (#${id}): ${(err as Error).message}`);
    }
  }
  log(payload, `${DEPARTMENTS.length} departments, ${assigned} of ${PEOPLE.length} people assigned`);

  const niklas = await person(args, NIKLAS, 'Niklas');
  if (niklas && niklas.published === false) {
    await payload.update({ collection: 'team', id: NIKLAS, data: { published: true }, depth: 0, req });
    log(payload, 'published Niklas');
  }
}

export async function down(args: MigrateDownArgs): Promise<void> {
  const { payload, req } = args;
  const found = await payload.find({
    collection: 'team-groups',
    where: { name: { in: DEPARTMENTS.map((d) => d.en) } },
    locale: 'en',
    limit: DEPARTMENTS.length,
    depth: 0,
    req,
  });
  const ours = new Set(found.docs.map((g) => g.id));

  for (const [id, first] of PEOPLE) {
    const doc = await person(args, id, first);
    const memberships = doc?.teamMemberships ?? [];
    const kept = memberships.filter((m) => !ours.has(typeof m.team === 'object' ? m.team.id : m.team));
    if (doc && kept.length !== memberships.length) {
      await payload.update({ collection: 'team', id, data: { teamMemberships: kept }, locale: 'en', depth: 0, req });
    }
  }
  for (const groupId of ours) await payload.delete({ collection: 'team-groups', id: groupId, req });

  const niklas = await person(args, NIKLAS, 'Niklas');
  if (niklas?.published) await payload.update({ collection: 'team', id: NIKLAS, data: { published: false }, depth: 0, req });
}
