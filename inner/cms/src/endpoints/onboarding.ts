import { randomBytes } from 'node:crypto';
import {
  commitTransaction,
  initTransaction,
  killTransaction,
  type Endpoint,
  type Payload,
  type PayloadRequest,
} from 'payload';
import type { Submission } from '../components/review/model';
import { applicantOf } from '../lib/onboarding/applicant';
import { addressProblem, normalizeAddress, proposeAddresses } from '../lib/onboarding/cfcEmail';
import { buildGoogleCsv, safeAddress, safeOrgUnitPath, safeText, type GoogleUserRow } from '../lib/onboarding/googleCsv';
import { planManualRows } from '../lib/onboarding/manual';
import { generatePassword, meetsGoogleRules } from '../lib/onboarding/password';
import { memberProgress, type MemberAccount } from '../lib/onboarding/progress';
import { buildSheetsHtml } from '../lib/onboarding/sheets';
import { docusealBase } from '../lib/onboarding/docuseal';
import { docusealConfigured } from '../lib/onboarding/member';
import { currentChecks, currentDocuments, setCheck } from '../lib/onboarding/store';
import type { AdmittedPerson, MemberProfile, OnboardingOverview, OnboardingTodo } from '../lib/onboarding/types';
import { siteOrigin } from '../lib/mediaUpload';
import { zipSize, zipStream, type ZipEntry } from '../lib/share/zip';
import { currentStages } from '../lib/stages';
import { poolOf, requireAdmin } from './util';

/**
 * The board's onboarding dashboard (/admin/onboarding, components/onboarding/).
 * Admins only (endpoints/util.ts), every one of them:
 *
 *   GET  /api/onboarding/admin/overview
 *        → OnboardingOverview (lib/onboarding/types.ts)
 *   POST /api/onboarding/admin/accounts
 *        { create?: [{ application, email, firstName?, lastName? }],
 *          manual?: [{ firstName, lastName, email, privateEmail? }],
 *          reissue?: [userId] }
 *        → 200 application/zip (google-users.csv + password-sheets.html), or
 *          400/409 { error, problems: [{ application?, manual?, user?, message }] }
 *          (`manual` is the row's index in the request's `manual`)
 *   POST /api/onboarding/admin/check    { user, item, done }
 *        → { user, item, done, at, by }
 *   POST /api/onboarding/admin/profile  { user, title?, projects?, published? }
 *        → { profile: MemberProfile }   (409 while the member has no profile)
 *
 * "accounts" creates the `users` rows (role member) for admitted applications
 * and answers, once, with the Google bulk-upload CSV and the printable
 * password sheets. The Google passwords exist only inside that request: they
 * go into the download and nowhere else, not into the database and not into
 * the log. Each account's Payload password is a second random value nobody
 * ever sees (members sign in with Google). `reissue` puts accounts that exist
 * into a new download with new passwords: for a download that got lost.
 * `manual` is for people the board added by hand, who never applied: the
 * same accounts (role member), only without `application`, checked by
 * lib/onboarding/manual.ts; someone with an admitted application or an
 * account under the same private address is refused, not created twice.
 */

const BASE = '/onboarding/admin';
const MAX_BATCH = 100;

type Problem = { application?: number; manual?: number; user?: number; message: string };

type OnboardingGlobal = {
  form?: number | { id: number } | null;
  memberTodos?: { id?: string | null; text?: string | null; linkUrl?: string | null; linkLabel?: string | null }[] | null;
  boardTodos?: { id?: string | null; text?: string | null; linkUrl?: string | null; linkLabel?: string | null }[] | null;
  documents?: { id?: string | null; title?: string | null }[] | null;
  googleOrgUnitPath?: string | null;
};

type UserDoc = MemberAccount & { teamProfile?: number | { id: number } | null };

/** The association's Google domain: the one Google sign-in is limited to. */
export const onboardingDomain = (): string =>
  process.env.GOOGLE_ALLOWED_DOMAIN?.trim().toLowerCase() || 'codingforchange.com';

const onboardingUrl = () => `${siteOrigin()}/onboarding`;

const idOf = (v: number | { id: number } | null | undefined): number | null =>
  v == null ? null : typeof v === 'object' ? v.id : v;

const todosOf = (rows: OnboardingGlobal['memberTodos']): OnboardingTodo[] =>
  (rows ?? [])
    .filter((r): r is { id: string; text: string; linkUrl?: string | null; linkLabel?: string | null } =>
      Boolean(r.id && r.text?.trim()),
    )
    .map((r) => ({ id: r.id, text: r.text.trim(), linkUrl: r.linkUrl?.trim() || null, linkLabel: r.linkLabel?.trim() || null }));

async function settings(req: PayloadRequest): Promise<OnboardingGlobal> {
  return (await req.payload.findGlobal({ slug: 'onboarding', depth: 0, locale: 'en', req })) as OnboardingGlobal;
}

const bad = (error: string, problems: Problem[] = [], status = 400) => Response.json({ error, problems }, { status });

async function readBody<T>(req: PayloadRequest): Promise<T | null> {
  try {
    return ((await req.json?.()) ?? {}) as T;
  } catch {
    return null;
  }
}

/** Everyone the dashboard tracks: accounts made from an application, and every member account. */
async function onboardingUsers(req: PayloadRequest): Promise<UserDoc[]> {
  const found = await req.payload.find({
    collection: 'users',
    where: { or: [{ application: { exists: true } }, { role: { equals: 'member' } }] },
    depth: 0,
    pagination: false,
    sort: 'email',
    req,
  });
  return found.docs as unknown as UserDoc[];
}

const inScope = (u: UserDoc) => u.role === 'member' || idOf(u.application) !== null;

async function allAddresses(payload: Payload): Promise<Set<string>> {
  const { rows } = await poolOf(payload).query('SELECT lower(email) AS email FROM users');
  return new Set(rows.map((r) => String(r.email)));
}

/** Every account's private address (lower case) → that account's address. */
async function privateOwners(payload: Payload): Promise<Map<string, string>> {
  const { rows } = await poolOf(payload).query(
    "SELECT lower(trim(private_email)) AS private, lower(email) AS email FROM users WHERE coalesce(trim(private_email), '') <> '' ORDER BY id",
  );
  const out = new Map<string, string>();
  for (const r of rows) if (!out.has(String(r.private))) out.set(String(r.private), String(r.email));
  return out;
}

type Application = { id: number; createdAt: string; submissionData?: Submission['submissionData'] };

async function admittedApplications(req: PayloadRequest, ids?: number[]): Promise<Application[]> {
  const stages = await currentStages(req.payload);
  const admitted = [...stages].filter(([, stage]) => stage === 'admitted').map(([id]) => id);
  const wanted = ids ? admitted.filter((id) => ids.includes(id)) : admitted;
  if (wanted.length === 0) return [];
  const found = await req.payload.find({
    collection: 'form-submissions',
    where: { id: { in: wanted } },
    depth: 0,
    pagination: false,
    select: { createdAt: true, submissionData: true },
    req,
  });
  return found.docs as unknown as Application[];
}

/** Admitted applications without an account, oldest first; one per private address (the newest application). */
function waitingFor(applications: Application[], users: UserDoc[]): Application[] {
  const linked = new Set(users.map((u) => idOf(u.application)).filter((id): id is number => id !== null));
  // Every tracked account's private address, also of accounts the board
  // added by hand: someone who applies after that is not offered a second one.
  const knownPrivate = new Set(users.filter((u) => u.privateEmail).map((u) => normalizeAddress(u.privateEmail!)));
  const newestPerAddress = new Map<string, Application>();
  const out: Application[] = [];
  for (const a of [...applications].sort((x, y) => y.createdAt.localeCompare(x.createdAt) || y.id - x.id)) {
    if (linked.has(a.id)) continue;
    const email = applicantOf(a).privateEmail;
    if (email) {
      if (knownPrivate.has(email) || newestPerAddress.has(email)) continue;
      newestPerAddress.set(email, a);
    }
    out.push(a);
  }
  return out.sort((x, y) => x.createdAt.localeCompare(y.createdAt) || x.id - y.id);
}

// ---- GET overview -----------------------------------------------------------

const overview: Endpoint = {
  path: `${BASE}/overview`,
  method: 'get',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const { payload } = req;
    const domain = onboardingDomain();
    const config = await settings(req);
    const formId = idOf(config.form);
    const memberTodos = todosOf(config.memberTodos);
    const boardTodos = todosOf(config.boardTodos);
    const documents = (config.documents ?? [])
      .filter((d): d is { id: string; title: string } => Boolean(d.id && d.title))
      .map((d) => ({ id: d.id, title: d.title }));

    const [users, applications, addresses] = await Promise.all([
      onboardingUsers(req),
      admittedApplications(req),
      allAddresses(payload),
    ]);

    const waiting = waitingFor(applications, users);
    const people = waiting.map((a) => ({ a, ...applicantOf(a) }));
    const proposals = proposeAddresses(people, domain, addresses);
    const admitted: AdmittedPerson[] = people.map((p, i) => ({
      application: p.a.id,
      appliedAt: p.a.createdAt,
      firstName: p.firstName,
      lastName: p.lastName,
      privateEmail: p.privateEmail,
      proposedEmail: proposals[i],
    }));

    const ids = users.map((u) => u.id);
    const teamIds = users.map((u) => idOf(u.teamProfile)).filter((id): id is number => id !== null);
    const [checks, started, submissions, team, projects] = await Promise.all([
      currentChecks(payload, ids),
      currentDocuments(payload, ids),
      formId && ids.length
        ? payload.find({
            collection: 'form-submissions',
            where: { and: [{ form: { equals: formId } }, { submittedBy: { in: ids } }] },
            depth: 0,
            pagination: false,
            sort: '-createdAt',
            select: { createdAt: true, submittedBy: true },
            req,
          })
        : null,
      teamIds.length
        ? payload.find({
            collection: 'team',
            where: { id: { in: teamIds } },
            depth: 0,
            pagination: false,
            locale: 'en',
            select: { name: true, role: true, published: true },
            req,
          })
        : null,
      payload.find({
        collection: 'projects',
        depth: 0,
        pagination: false,
        locale: 'en',
        sort: 'title',
        select: { title: true, team: true },
        req,
      }),
    ]);

    const sentAt = new Map<number, string>();
    for (const s of (submissions?.docs ?? []) as unknown as { createdAt: string; submittedBy?: number | { id: number } }[]) {
      const by = idOf(s.submittedBy);
      if (by !== null && !sentAt.has(by)) sentAt.set(by, s.createdAt);
    }
    const projectDocs = projects.docs as unknown as { id: number; title?: string; team?: { member?: number | { id: number } }[] | null }[];
    const profiles = new Map<number, MemberProfile>();
    for (const t of (team?.docs ?? []) as unknown as { id: number; name: string; role?: string | null; published?: boolean | null }[]) {
      profiles.set(t.id, {
        id: t.id,
        name: t.name,
        title: t.role ?? '',
        published: t.published !== false,
        projects: projectDocs.filter((p) => (p.team ?? []).some((row) => idOf(row.member) === t.id)).map((p) => p.id),
      });
    }

    const docuseal = docusealConfigured();
    const members = users.map((u) => {
      const teamId = idOf(u.teamProfile);
      return memberProgress({
        account: u,
        memberTodos,
        boardTodos,
        documents,
        checks: checks.filter((c) => c.user === u.id),
        started: started.filter((d) => d.user === u.id),
        formConfigured: formId !== null,
        formSubmittedAt: sentAt.get(u.id) ?? null,
        profile: teamId !== null ? (profiles.get(teamId) ?? null) : null,
        docusealConfigured: docuseal,
      });
    });

    const body: OnboardingOverview = {
      domain,
      orgUnitPath: safeOrgUnitPath(config.googleOrgUnitPath),
      onboardingUrl: onboardingUrl(),
      formConfigured: formId !== null,
      docuseal: { configured: docuseal, url: docuseal ? docusealBase() : null },
      projects: projectDocs.map((p) => ({ id: p.id, title: p.title ?? `Project ${p.id}` })),
      accountAddresses: [...addresses].filter((a) => a.endsWith(`@${domain}`)).sort(),
      admitted,
      members,
    };
    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  },
};

// ---- POST accounts ----------------------------------------------------------

type CreateRequest = { application?: unknown; email?: unknown; firstName?: unknown; lastName?: unknown };

/** One person going into the download, before anything is written. */
type Planned =
  | { kind: 'create'; application: number | null; email: string; firstName: string; lastName: string; privateEmail: string }
  | { kind: 'reissue'; user: number; email: string; firstName: string; lastName: string; privateEmail: string };

const isUniqueViolation = (err: unknown): boolean => {
  const e = err as { code?: unknown; cause?: { code?: unknown }; message?: unknown } | null;
  // Postgres' unique violation, or Payload's own check of a unique field
  // ("The following field is invalid: email"), whichever comes first.
  return (
    e?.code === '23505' ||
    e?.cause?.code === '23505' ||
    /fields? (is|are) invalid:.*\b(email|application)\b/i.test(String(e?.message ?? ''))
  );
};

const stamp = (d: Date) => d.toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-');

const accounts: Endpoint = {
  path: `${BASE}/accounts`,
  method: 'post',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const { payload } = req;
    const body = await readBody<{ create?: unknown; manual?: unknown; reissue?: unknown }>(req);
    if (!body) return bad('Invalid JSON body.');
    const createList = (Array.isArray(body.create) ? body.create : []) as CreateRequest[];
    const manualList: unknown[] = Array.isArray(body.manual) ? body.manual : [];
    const reissueList = Array.isArray(body.reissue) ? body.reissue.map(Number) : [];
    if (
      (body.create !== undefined && !Array.isArray(body.create)) ||
      (body.manual !== undefined && !Array.isArray(body.manual)) ||
      (body.reissue !== undefined && !Array.isArray(body.reissue))
    ) {
      return bad(
        'Expected { create?: [{ application, email }], manual?: [{ firstName, lastName, email, privateEmail? }], reissue?: [user id] }.',
      );
    }
    const total = createList.length + manualList.length + reissueList.length;
    if (total === 0) return bad('Nobody selected.');
    if (total > MAX_BATCH) return bad(`At most ${MAX_BATCH} people at once.`);

    const domain = onboardingDomain();
    const problems: Problem[] = [];
    let conflict = false;
    const planned: Planned[] = [];

    const [users, addresses] = await Promise.all([onboardingUsers(req), allAddresses(payload)]);
    const requestedIds = createList.map((c) => Number(c.application)).filter(Number.isInteger);
    const applications = new Map((await admittedApplications(req, requestedIds)).map((a) => [a.id, a]));
    const linked = new Set(users.map((u) => idOf(u.application)));
    const inBatch = new Set<string>();
    const seenApplications = new Set<number>();

    for (const c of createList) {
      const application = Number(c.application);
      if (!Number.isInteger(application)) {
        problems.push({ message: 'An entry without an application id.' });
        continue;
      }
      if (seenApplications.has(application)) {
        problems.push({ application, message: 'Listed twice.' });
        continue;
      }
      seenApplications.add(application);
      const a = applications.get(application);
      if (linked.has(application)) {
        conflict = true;
        problems.push({ application, message: 'Has an account already. Reload the page.' });
        continue;
      }
      if (!a) {
        conflict = true;
        problems.push({ application, message: 'Not an admitted application (any more). Reload the page.' });
        continue;
      }
      const person = applicantOf(a);
      const firstName = safeText(typeof c.firstName === 'string' ? c.firstName : person.firstName);
      const lastName = safeText(typeof c.lastName === 'string' ? c.lastName : person.lastName);
      const email = normalizeAddress(typeof c.email === 'string' ? c.email : '');
      if (!firstName || !lastName) {
        problems.push({ application, message: 'First and last name are needed.' });
        continue;
      }
      const wrong = addressProblem(email, domain);
      if (wrong) {
        problems.push({ application, message: wrong });
        continue;
      }
      if (addresses.has(email)) {
        conflict = true;
        problems.push({ application, message: `${email} belongs to an account already.` });
        continue;
      }
      if (inBatch.has(email)) {
        problems.push({ application, message: `${email} is given to two people.` });
        continue;
      }
      inBatch.add(email);
      planned.push({ kind: 'create', application, email, firstName, lastName, privateEmail: person.privateEmail });
    }

    if (manualList.length > 0) {
      // Someone added by hand may have applied after all: the private
      // address finds their admitted application (one per address, as in
      // the list), or an account they have already.
      const [owners, allAdmitted] = await Promise.all([privateOwners(payload), admittedApplications(req)]);
      const admittedByPrivate = new Map<string, number>();
      for (const a of waitingFor(allAdmitted, users)) {
        const email = applicantOf(a).privateEmail;
        if (email) admittedByPrivate.set(email, a.id);
      }
      const manual = planManualRows(manualList, {
        domain,
        accountAddresses: addresses,
        privateOwners: owners,
        admittedByPrivate,
        applicationsInBatch: seenApplications,
        inBatch,
      });
      for (const p of manual.problems) {
        if (p.conflict) conflict = true;
        problems.push({ manual: p.manual, message: p.message });
      }
      for (const m of manual.planned) planned.push({ kind: 'create', application: null, ...m });
    }

    const byId = new Map(users.map((u) => [u.id, u]));
    for (const id of new Set(reissueList)) {
      const u = Number.isInteger(id) ? byId.get(id) : undefined;
      if (!u || !inScope(u)) {
        problems.push({ user: id, message: 'Not a member account.' });
        continue;
      }
      const firstName = safeText(u.firstName ?? '');
      const lastName = safeText(u.lastName ?? '');
      if (!firstName || !lastName) {
        problems.push({ user: id, message: 'The account has no first and last name. Add them under Users first.' });
        continue;
      }
      planned.push({ kind: 'reissue', user: id, email: normalizeAddress(u.email), firstName, lastName, privateEmail: u.privateEmail ?? '' });
    }

    if (problems.length > 0) {
      return bad(
        conflict ? 'Something changed since the page was loaded. Nothing was created.' : 'Nothing was created. Please fix these first.',
        problems,
        conflict ? 409 : 400,
      );
    }

    // Everything for the download first, in memory: if any of it failed
    // there would be accounts without a download.
    const rows: GoogleUserRow[] = planned.map((p) => ({
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      password: generatePassword(),
      recoveryEmail: p.privateEmail,
    }));
    if (!rows.every((r) => meetsGoogleRules(r.password))) throw new Error('[onboarding] generated password breaks the rules');
    const config = await settings(req);
    const now = new Date();
    const csv = Buffer.from(buildGoogleCsv(rows, config.googleOrgUnitPath ?? '/'), 'utf8');
    const html = Buffer.from(buildSheetsHtml(rows, onboardingUrl()), 'utf8');

    // All accounts or none: one transaction, so a failure halfway (or a
    // second click racing the first: `users.application` and `email` are
    // unique) leaves nothing behind.
    const owns = await initTransaction(req);
    try {
      for (const p of planned) {
        if (p.kind === 'create') {
          await payload.create({
            collection: 'users',
            data: {
              email: p.email,
              // Not the Google password: a random one nobody knows. Members
              // sign in with Google; password sign-in is for admins only.
              password: randomBytes(32).toString('base64url'),
              role: 'member',
              firstName: p.firstName,
              lastName: p.lastName,
              // A typo in the application ("name at gmail") would fail the
              // email field and with it the whole batch: kept only when it is
              // a plain address (the CSV then has no recovery address either).
              privateEmail: safeAddress(p.privateEmail) || undefined,
              // None for someone the board added by hand.
              application: p.application ?? undefined,
              accountExportedAt: now.toISOString(),
            },
            overrideAccess: true,
            req,
          });
        } else {
          await payload.update({
            collection: 'users',
            id: p.user,
            data: { accountExportedAt: now.toISOString() },
            overrideAccess: true,
            req,
          });
        }
      }
      if (owns) await commitTransaction(req);
    } catch (err) {
      if (owns) await killTransaction(req);
      if (isUniqueViolation(err)) {
        return bad(
          'An account for one of these people was created in the meantime (a second click or another tab?). Nothing was created. Reload the page.',
          [],
          409,
        );
      }
      // The message only: the error never carries a Google password (they are
      // not passed to Payload), but there is no need to log row data either.
      payload.logger.error(`[onboarding] creating accounts failed: ${(err as Error)?.message ?? err}`);
      return bad('Creating the accounts failed. Nothing was created.', [], 500);
    }

    const created = planned.filter((p) => p.kind === 'create').length;
    const byHand = planned.filter((p) => p.kind === 'create' && p.application === null).length;
    payload.logger.info(
      `[onboarding] ${String((req.user as { email?: string })?.email ?? 'admin')} exported ${planned.length} account(s): ${created} new (${byHand} added by hand), ${planned.length - created} with new passwords`,
    );

    const entries: ZipEntry[] = [
      { name: 'google-users.csv', size: csv.length, modified: now, read: async () => csv },
      { name: 'password-sheets.html', size: html.length, modified: now, read: async () => html },
    ];
    return new Response(zipStream(entries), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(zipSize(entries)),
        'Content-Disposition': `attachment; filename="cfc-accounts-${stamp(now)}.zip"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Accounts-Created': String(created),
        'X-Accounts-Reissued': String(planned.length - created),
      },
    });
  },
};

// ---- POST check -------------------------------------------------------------

const check: Endpoint = {
  path: `${BASE}/check`,
  method: 'post',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const body = await readBody<{ user?: unknown; item?: unknown; done?: unknown }>(req);
    const user = Number(body?.user);
    const item = typeof body?.item === 'string' ? body.item : '';
    if (!body || !Number.isInteger(user) || !item || typeof body.done !== 'boolean') {
      return bad('Expected { user: id, item: board to-do id, done: true | false }.');
    }
    const todo = todosOf((await settings(req)).boardTodos).find((t) => t.id === item);
    if (!todo) return bad('No such board to-do (any more). Reload the page.', [], 404);
    const account = (await req.payload.findByID({ collection: 'users', id: user, depth: 0, req }).catch(() => null)) as UserDoc | null;
    if (!account || !inScope(account)) return bad('Not a member account.', [], 404);
    const by = String((req.user as { email?: string } | null)?.email ?? 'admin');
    const { at } = await setCheck(req.payload, {
      user,
      kind: 'board',
      item,
      text: todo.text,
      linkUrl: todo.linkUrl,
      done: body.done,
      by,
    });
    return Response.json({ user, item, done: body.done, at, by });
  },
};

// ---- POST profile -----------------------------------------------------------

type ProjectRow = { id?: string | null; member?: number | { id: number } | null; role?: string | null };

const profile: Endpoint = {
  path: `${BASE}/profile`,
  method: 'post',
  handler: async (req) => {
    const denied = requireAdmin(req);
    if (denied) return denied;
    const { payload } = req;
    const body = await readBody<{ user?: unknown; title?: unknown; projects?: unknown; published?: unknown }>(req);
    const user = Number(body?.user);
    const title = body?.title === undefined ? undefined : typeof body.title === 'string' ? body.title.trim() : null;
    const projects =
      body?.projects === undefined
        ? undefined
        : Array.isArray(body.projects) && body.projects.every((p) => Number.isInteger(Number(p)))
          ? [...new Set(body.projects.map(Number))]
          : null;
    const published = body?.published === undefined ? undefined : typeof body.published === 'boolean' ? body.published : null;
    if (!body || !Number.isInteger(user) || title === null || projects === null || published === null) {
      return bad('Expected { user: id, title?: string, projects?: [project id], published?: boolean }.');
    }
    if (title !== undefined && (!title || title.length > 120)) return bad('The title must be 1 to 120 characters.');

    const account = (await payload.findByID({ collection: 'users', id: user, depth: 0, req }).catch(() => null)) as UserDoc | null;
    if (!account || !inScope(account)) return bad('Not a member account.', [], 404);
    const teamId = idOf(account.teamProfile);
    if (teamId === null) {
      return bad('No profile yet: it is made when the member sends the onboarding form.', [], 409);
    }
    const entry = await payload.findByID({ collection: 'team', id: teamId, depth: 0, req }).catch(() => null);
    if (!entry) return bad('The team profile is gone. It is made again when the member sends the onboarding form.', [], 409);

    if (title !== undefined) {
      // `role` is localized. The title goes into English, which the German
      // page falls back to; a German role of its own is replaced too, so the
      // two never disagree (editors can reword it in Team afterwards). A
      // profile without German texts is left without: Payload would refuse
      // the German save for its missing German bio.
      await payload.update({ collection: 'team', id: teamId, data: { role: title }, locale: 'en', req });
      const german = (await payload.findByID({
        collection: 'team',
        id: teamId,
        depth: 0,
        locale: 'de',
        fallbackLocale: false,
        req,
      })) as { role?: string | null; bio?: string | null };
      if (german.role && german.role !== title) {
        await payload
          .update({ collection: 'team', id: teamId, data: { role: title }, locale: 'de', req })
          .catch((err: Error) =>
            payload.logger.warn(`[onboarding] German title of team ${teamId} not updated: ${err.message}`),
          );
      }
    }
    if (published !== undefined) {
      await payload.update({ collection: 'team', id: teamId, data: { published }, req });
    }
    if (projects !== undefined) {
      const all = await payload.find({
        collection: 'projects',
        depth: 0,
        pagination: false,
        locale: 'en',
        select: { team: true },
        req,
      });
      const docs = all.docs as unknown as { id: number; team?: ProjectRow[] | null }[];
      const unknown = projects.filter((id) => !docs.some((d) => d.id === id));
      if (unknown.length) return bad(`No project with id ${unknown.join(', ')}.`, [], 404);
      for (const doc of docs) {
        const rows = doc.team ?? [];
        const has = rows.some((r) => idOf(r.member) === teamId);
        const wants = projects.includes(doc.id);
        if (has === wants) continue;
        // Row ids kept, so the other language's role on each row stays as it is.
        const next = wants
          ? [...rows, { member: teamId }]
          : rows.filter((r) => idOf(r.member) !== teamId);
        await payload.update({
          collection: 'projects',
          id: doc.id,
          data: { team: next.map((r) => ({ ...r, member: idOf(r.member) as number })) },
          locale: 'en',
          req,
        });
      }
    }

    const fresh = (await payload.findByID({ collection: 'team', id: teamId, depth: 0, locale: 'en', req })) as unknown as {
      id: number;
      name: string;
      role?: string | null;
      published?: boolean | null;
    };
    const inProjects = await payload.find({
      collection: 'projects',
      where: { 'team.member': { equals: teamId } },
      depth: 0,
      pagination: false,
      select: { title: true },
      req,
    });
    const result: MemberProfile = {
      id: fresh.id,
      name: fresh.name,
      title: fresh.role ?? '',
      published: fresh.published !== false,
      projects: inProjects.docs.map((d) => d.id as number),
    };
    return Response.json({ profile: result });
  },
};

export const onboardingEndpoints: Endpoint[] = [overview, accounts, check, profile];
