import { createLocalReq, type Endpoint, type PayloadRequest } from 'payload';
import { z } from 'zod';
import { analyticsApplications } from '../endpoints/analyticsApplications';
import { analyticsExportEndpoints } from '../endpoints/analyticsExport';
import { analyticsFlow } from '../endpoints/analyticsFlow';
import { analyticsSummary } from '../endpoints/analyticsSummary';
import { hostMarkEndpoints } from '../endpoints/hostMarks';
import { mailingEndpoints } from '../endpoints/mailing';
import { memberEndpoints } from '../endpoints/members';
import { stageEndpoints } from '../endpoints/stages';
import { withdrawalEndpoints } from '../endpoints/withdrawals';
import { DOWNLOAD_MINUTES, issueDownloadToken } from './applicantFileLink';
import { emptyConfig, type SourceKey } from './mailing/model';
import { countsOf, type Resolution } from './mailing/resolve';
import { getMailing, latestSendId } from './mailing/store';
import { idOf, mcpKeyOf, text, type CustomTool } from './mcp';
import { siteOrigin } from './mediaUpload';
import { APPLICATION_STAGES } from './stageOptions';

/**
 * The admin tools over MCP: mailing, the review workspace's stages and marks,
 * analytics, CV downloads. Each tool runs the same endpoint the admin UI calls
 * (endpoints/*), as the MCP key's user, so every check the admin gets – the
 * send's confirmed numbers, "only a mailing that never went out can be
 * deleted", who did what – holds here too. Each tool has its own on/off box
 * per key (admin → MCP API Keys → Tools).
 */

type Call = { params?: Record<string, string | number>; query?: Record<string, string | number | undefined>; body?: unknown };

const pick = (list: Endpoint[], method: Endpoint['method'], path: string): Endpoint => {
  const found = list.find((e) => e.method === method && e.path === path);
  if (!found) throw new Error(`[mcp] no endpoint ${method.toUpperCase()} ${path}`);
  return found;
};

/** Run an admin endpoint as the MCP key's user. */
async function call(req: PayloadRequest, endpoint: Endpoint, c: Call = {}): Promise<{ ok: boolean; status: number; body: string }> {
  const user = mcpKeyOf(req)?.user as { collection?: unknown } | undefined;
  if (!user || typeof user !== 'object' || user.collection !== 'users') {
    return { ok: false, status: 401, body: 'Could not identify the admin user of this MCP API key.' };
  }
  const routeParams = Object.fromEntries(Object.entries(c.params ?? {}).map(([k, v]) => [k, String(v)]));
  const url = new URL(`/api${endpoint.path.replace(/:(\w+)/g, (_, k: string) => encodeURIComponent(routeParams[k] ?? ''))}`, siteOrigin());
  for (const [k, v] of Object.entries(c.query ?? {})) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const local = await createLocalReq(
    {
      req: { url: url.href, routeParams, headers: new Headers(), json: async () => c.body ?? {} } as Partial<PayloadRequest>,
      user: user as unknown as PayloadRequest['user'] & object,
    },
    req.payload,
  );
  const res = await endpoint.handler(local);
  return { ok: res.ok, status: res.status, body: await res.text() };
}

const answer = (r: { ok: boolean; status: number; body: string }) => text(r.ok ? r.body : `Error ${r.status}: ${r.body}`);

const run = (endpoint: Endpoint, toCall: (args: Record<string, unknown>) => Call = () => ({})): CustomTool['handler'] =>
  async (args, req) => answer(await call(req, endpoint, toCall(args)));

const id = (what: string) => z.number().int().positive().describe(what);

// ---- mailing ----------------------------------------------------------------

const M = (method: Endpoint['method'], path: string) => pick(mailingEndpoints, method, path);
const SOURCE_KEYS = ['applications', 'waitlist', 'techtour'] as const satisfies readonly SourceKey[];

const CONFIG_HELP = [
  'config = { groups: [{ id, label, filter, mail: { en: { subject, message, ctaLabel }, de: { … } }, ctaUrl }],',
  'onlyOnce (default true: skip people this mailing already reached), requireAll (refuse to send while someone fits no group),',
  'headerImageUrl (absolute image URL or ""), excluded (entries left out by hand, "s:<submission id>" or "w:<waitlist signup id>") }.',
  'A person gets the first group whose filter they match. filter keys and their options per source come from getMailingSources',
  '(choice = array of option values, range = { min, max }, flag = "yes" | "no" | "any"); {} matches everyone.',
  'Placeholders in subject/message/ctaUrl: {{firstName}}, {{link}} (the button link), {{manageLink}} (TechTour only: the person\'s own manage link).',
  'message is plain text with blank lines between paragraphs. A language left empty falls back to the other one.',
].join(' ');

const withMailing = (handler: (m: NonNullable<Awaited<ReturnType<typeof getMailing>>>, args: Record<string, unknown>, req: PayloadRequest) => Promise<ReturnType<typeof text>>): CustomTool['handler'] =>
  async (args, req) => {
    const mailing = await getMailing(req.payload, Number(args.id));
    return mailing ? handler(mailing, args, req) : text('Error 404: No such mailing.');
  };

const mailingTools: CustomTool[] = [
  {
    name: 'listMailings',
    description: 'List all mailings of the CMS mailing tool (/admin/mailing) with their source and send counts.',
    parameters: {},
    handler: run(M('get', '/mailing/mailings')),
  },
  {
    name: 'getMailing',
    description:
      'One mailing: its title, source and config (groups, texts, filters), its sends (newest last) and every recipient so far with status. Recipient ids work with getSentMail.',
    parameters: { id: id('Mailing id') },
    handler: run(M('get', '/mailing/mailings/:id'), (a) => ({ params: { id: Number(a.id) } })),
  },
  {
    name: 'getMailingSources',
    description:
      'The filters each mailing source offers (applications, waitlist, techtour) with their options from the current data – the keys to use in a group\'s filter.',
    parameters: {},
    handler: run(M('get', '/mailing/sources')),
  },
  {
    name: 'createMailing',
    description: `Create a mailing (a draft – nothing is sent). source: applications (membership applicants), waitlist, techtour (TechTour registrations). ${CONFIG_HELP} Without config it starts with one group "Everyone". Returns { id }.`,
    parameters: {
      title: z.string().max(200).describe('Title shown in the mailing list'),
      source: z.enum(SOURCE_KEYS),
      config: z.record(z.string(), z.unknown()).optional().describe('Mailing config, see the description'),
    },
    handler: run(M('post', '/mailing/mailings'), (a) => ({ body: { title: a.title, source: a.source, config: a.config ?? emptyConfig() } })),
  },
  {
    name: 'updateMailing',
    description: `Change a mailing's title and/or config. The config replaces the saved one as a whole – start from getMailing's config and change what you need. Without config only the title changes. ${CONFIG_HELP}`,
    parameters: {
      id: id('Mailing id'),
      title: z.string().max(200).optional(),
      config: z.record(z.string(), z.unknown()).optional().describe('The whole new config'),
    },
    handler: withMailing(async (m, a, req) =>
      answer(
        await call(req, M('patch', '/mailing/mailings/:id'), {
          params: { id: m.id },
          body: { title: a.title ?? m.title, config: a.config ?? m.config },
        }),
      ),
    ),
  },
  {
    name: 'deleteMailing',
    description: 'Delete a mailing that never went out. A mailing that was sent stays as history and cannot be deleted.',
    parameters: { id: id('Mailing id') },
    handler: run(M('delete', '/mailing/mailings/:id'), (a) => ({ params: { id: Number(a.id) } })),
  },
  {
    name: 'checkMailing',
    description:
      'Who would get what if the saved mailing were sent now: per group the people (name, email, language) and the problems that block a send. Ends with "counts" and "lastSend" – the values sendMailing needs. Sends nothing.',
    parameters: { id: id('Mailing id') },
    handler: withMailing(async (m, _a, req) => {
      const r = await call(req, M('post', '/mailing/resolve'), { body: { source: m.source, config: m.config, mailing: m.id } });
      if (!r.ok) return answer(r);
      const resolution = JSON.parse(r.body) as Resolution;
      return text(JSON.stringify({ ...resolution, counts: countsOf(resolution), lastSend: await latestSendId(req.payload, m.id) }));
    }),
  },
  {
    name: 'sendTestMail',
    description:
      'Send one group\'s mail of the saved mailing as a test, subject prefixed "[Test]", with a sample first name. Goes to `to` (up to 10 addresses) or, without `to`, to the MCP key\'s admin. Mails to @codingforchange.com addresses often do not arrive – use another address.',
    parameters: {
      id: id('Mailing id'),
      group: z.string().describe('Group id from the mailing config'),
      lang: z.enum(['en', 'de']).optional(),
      to: z.string().optional().describe('Addresses, separated by commas'),
      sampleName: z.string().max(100).optional().describe('First name to fill in (default "Alex")'),
    },
    handler: withMailing(async (m, a, req) =>
      answer(
        await call(req, M('post', '/mailing/test'), {
          body: { source: m.source, config: m.config, group: a.group, lang: a.lang ?? 'en', to: a.to, sampleName: a.sampleName },
        }),
      ),
    ),
  },
  {
    name: 'sendMailing',
    description: [
      'Send the saved mailing to its real recipients – every person gets their own mail. This cannot be undone.',
      'First call checkMailing, show the user how many people get which group\'s mail, and send only after the user explicitly confirmed those numbers in this conversation.',
      'Pass `counts` and `lastSend` exactly as checkMailing returned them: the server sorts the people again and refuses when anything changed since (a decision, an edit, another send).',
    ].join(' '),
    parameters: {
      id: id('Mailing id'),
      counts: z.record(z.string(), z.number().int().nonnegative()).describe('checkMailing\'s "counts": { group id: number of people }'),
      lastSend: z.number().int().nonnegative().describe('checkMailing\'s "lastSend"'),
    },
    handler: withMailing(async (m, a, req) =>
      answer(
        await call(req, M('post', '/mailing/mailings/:id/send'), {
          params: { id: m.id },
          body: { expected: a.counts, lastSend: a.lastSend, config: m.config },
        }),
      ),
    ),
  },
  {
    name: 'getSentMail',
    description: 'The mail one recipient got (subject and text), as it was sent. Recipient ids come from getMailing.',
    parameters: { recipient: id('Recipient id from getMailing') },
    handler: run(M('get', '/mailing/recipients/:id'), (a) => ({ params: { id: Number(a.recipient) }, query: { format: 'text' } })),
  },
  {
    name: 'listMailedPeople',
    description: 'Every mail the mailing tool sent, per person (address, mailing, group, status, time) – what the review workspace shows as a person\'s mails.',
    parameters: {},
    handler: run(M('get', '/mailing/people')),
  },
];

// ---- review workspace: application stages, TechTour marks ------------------------

const reviewTools: CustomTool[] = [
  {
    name: 'getApplicationStages',
    description:
      'Where membership applications stand after the written review: { stages: { application id: stage } }. The review status, score and notes themselves are fields of the form submission (findFormSubmissions / updateFormSubmissions).',
    parameters: {},
    handler: run(pick(stageEndpoints, 'get', '/applications/stages')),
  },
  {
    name: 'setApplicationStage',
    description: `Set a membership application's stage: ${APPLICATION_STAGES.map((s) => `"${s.value}" (${s.label})`).join(', ')}, or null to clear it. Recorded with the MCP key's admin and the time.`,
    parameters: {
      submission: id('Form submission id of the application'),
      stage: z.enum(APPLICATION_STAGES.map((s) => s.value) as [string, ...string[]]).nullable(),
    },
    handler: run(pick(stageEndpoints, 'post', '/applications/stages'), (a) => ({ body: { submission: a.submission, stage: a.stage } })),
  },
  {
    name: 'getTechTourMembers',
    description: 'TechTour registrations marked as Coding for Change members: { ids: [registration id…] }.',
    parameters: {},
    handler: run(pick(memberEndpoints, 'get', '/techtour/members')),
  },
  {
    name: 'setTechTourMember',
    description: 'Mark a TechTour registration as a Coding for Change member, or take the mark off.',
    parameters: { submission: id('Form submission id of the TechTour registration'), member: z.boolean() },
    handler: run(pick(memberEndpoints, 'post', '/techtour/members'), (a) => ({ body: { submission: a.submission, member: a.member } })),
  },
  {
    name: 'getTechTourWithdrawals',
    description:
      'Evenings TechTour registrants gave up through their own link: { evenings: { registration id: { evening key: { withdrawn, at, by } } } }.',
    parameters: {},
    handler: run(pick(withdrawalEndpoints, 'get', '/techtour/withdrawals')),
  },
  {
    name: 'setTechTourWithdrawal',
    description:
      'Add back an evening a registrant gave up (withdrawn: false), or undo such an add-back (withdrawn: true). Only evenings the person gave up themselves can be changed.',
    parameters: {
      submission: id('Form submission id of the TechTour registration'),
      option: z.string().describe('Evening key, as in getTechTourWithdrawals'),
      withdrawn: z.boolean(),
    },
    handler: run(pick(withdrawalEndpoints, 'post', '/techtour/withdrawals'), (a) => ({
      body: { submission: a.submission, option: a.option, withdrawn: a.withdrawn },
    })),
  },
  {
    name: 'getHostMarks',
    description:
      'What TechTour hosts did on their share links besides decisions: scores (1–10 per registration and evening) and moves (who moved up from a waitlist, and whether the mail went out).',
    parameters: {},
    handler: run(pick(hostMarkEndpoints, 'get', '/techtour/host-marks')),
  },
];

// ---- analytics ----------------------------------------------------------------------

const REPORTS: Record<string, Endpoint> = {
  summary: analyticsSummary,
  flow: analyticsFlow,
  applications: analyticsApplications,
  'campaigns.csv': pick(analyticsExportEndpoints, 'get', '/analytics/campaigns.csv'),
  'events.csv': pick(analyticsExportEndpoints, 'get', '/analytics/events.csv'),
  'signups.csv': pick(analyticsExportEndpoints, 'get', '/analytics/signups.csv'),
};
const MAX_CSV_CHARS = 150_000;

const analyticsTool: CustomTool = {
  name: 'getAnalytics',
  description: [
    'The site\'s own analytics (/admin/analytics). Reports:',
    'summary (visits, pages, sources, CTAs, conversions), flow (common paths through the site),',
    'applications (the application funnel per kind: membership, speedrun, techtour),',
    'campaigns.csv (funnel by source and channel), events.csv (raw events), signups.csv (waitlist signups with attribution).',
    'Range: days (7, 30, 90 or 365, ending today; default 30) or from + to (YYYY-MM-DD, inclusive). The CSVs take from/to only.',
  ].join(' '),
  parameters: {
    report: z.enum(Object.keys(REPORTS) as [string, ...string[]]),
    days: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)]).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  },
  handler: async (args, req) => {
    const report = String(args.report);
    const endpoint = REPORTS[report];
    if (!endpoint) return text('Error: unknown report.');
    const csv = report.endsWith('.csv');
    const r = await call(req, endpoint, {
      query: { days: csv ? undefined : (args.days as number | undefined), from: args.from as string, to: args.to as string },
    });
    if (!r.ok || r.body.length <= MAX_CSV_CHARS) return answer(r);
    const cut = r.body.lastIndexOf('\n', MAX_CSV_CHARS);
    return text(`${r.body.slice(0, cut)}\n[cut off after ${MAX_CSV_CHARS} characters – ask for a shorter range]`);
  },
};

// ---- CVs ----------------------------------------------------------------------------

const applicantFileTool: CustomTool = {
  name: 'createApplicantFileDownloadUrl',
  description: [
    'Get a download URL for an applicant file (a CV, PDF) – a tool result cannot carry the PDF itself.',
    'The file id is in the form submission\'s "files" field (findFormSubmissions); findApplicantFiles lists the files.',
    `Fetch it from your code sandbox, e.g. \`curl -sS -o cv.pdf "<url>"\`, then read it (e.g. \`pdftotext cv.pdf -\`). Valid for ${DOWNLOAD_MINUTES} minutes.`,
    'If your sandbox cannot reach the site, give the URL to the user to open.',
  ].join(' '),
  parameters: { file: id('Applicant file id') },
  handler: async (args, req) => {
    const key = mcpKeyOf(req);
    const keyId = idOf(key);
    const userId = idOf(key?.user);
    if (!key || keyId == null || userId == null) return text('Error: could not identify the MCP API key for this request.');
    if ((key.applicantFiles as { find?: boolean } | undefined)?.find !== true) {
      return text('Error: this MCP API key may not read applicant files. An admin can tick "Applicant files → find" on the key.');
    }
    const file = await req.payload
      .findByID({ collection: 'applicant-files', id: Number(args.file), depth: 0, overrideAccess: true })
      .catch(() => null);
    if (!file) return text('Error 404: No such applicant file.');
    const { token, expires } = issueDownloadToken({ fileId: file.id, keyId, userId });
    req.payload.logger.info(`[applicant-file] link for file ${file.id} issued to MCP key ${keyId}`);
    const url = `${siteOrigin()}/api/applicant-file/${token}`;
    return text(
      [
        `Download URL for ${file.filename} (valid until ${new Date(expires).toISOString()}):`,
        url,
        '',
        `curl -sS -o cv.pdf "${url}" && pdftotext cv.pdf -`,
      ].join('\n'),
    );
  },
};

export const adminTools: CustomTool[] = [...mailingTools, ...reviewTools, analyticsTool, applicantFileTool];
