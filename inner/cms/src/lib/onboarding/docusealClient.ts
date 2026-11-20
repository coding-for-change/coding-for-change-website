import { docusealBase } from './docuseal';

/**
 * The few DocuSeal API calls the onboarding makes, against the association's
 * own instance: <DOCUSEAL_URL>/api, authenticated with the `X-Auth-Token`
 * header (DOCUSEAL_API_KEY). Every call times out after TIMEOUT_MS, and every
 * failure is a DocusealError, so the caller can answer the member clearly
 * and store nothing.
 *
 *   POST   /submissions       create one for one submitter, no DocuSeal mail
 *   GET    /submissions/{id}  its state (resync)
 *   DELETE /submissions/{id}  archive it (only to undo one we could not store)
 */

const TIMEOUT_MS = 10_000;

export class DocusealError extends Error {
  constructor(
    message: string,
    /** "unreachable": no answer; "rejected": an HTTP error; "malformed": an answer we cannot read. */
    readonly kind: 'unconfigured' | 'unreachable' | 'rejected' | 'malformed',
    readonly status?: number,
    /** Set when DocuSeal did create a submission that we then could not use: the caller archives it. */
    readonly createdSubmissionId?: number,
  ) {
    super(message);
  }
}

function config(): { api: string; key: string } {
  const base = docusealBase();
  const key = process.env.DOCUSEAL_API_KEY?.trim();
  if (!base || !key) throw new DocusealError('DocuSeal is not configured', 'unconfigured');
  return { api: `${base}/api`, key };
}

async function call(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<unknown> {
  const { api, key } = config();
  let res: Response;
  try {
    res = await fetch(`${api}${path}`, {
      method,
      headers: {
        'X-Auth-Token': key,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'error',
      cache: 'no-store',
    });
  } catch (err) {
    throw new DocusealError(`DocuSeal unreachable: ${(err as Error)?.name ?? 'error'}`, 'unreachable');
  }
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    // DocuSeal answers errors as { error: "..." }; only that, never the body itself.
    let detail = '';
    try {
      const e = (JSON.parse(text) as { error?: unknown })?.error;
      if (typeof e === 'string') detail = `: ${e.slice(0, 200)}`;
    } catch {
      /* not JSON */
    }
    throw new DocusealError(`DocuSeal answered ${res.status}${detail}`, 'rejected', res.status);
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new DocusealError('DocuSeal answered something other than JSON', 'malformed', res.status);
  }
}

export type CreatedSubmission = { submissionId: number; slug: string };

/**
 * One submission of `templateId` for one submitter, without DocuSeal's own
 * mail (`send_email: false`, on the submission and the submitter): the member
 * opens it from their onboarding page. The answer is the array of submitters.
 */
export async function createSubmission(input: {
  templateId: number;
  name: string;
  email: string;
  externalId: string;
  completedRedirectUrl?: string;
}): Promise<CreatedSubmission> {
  const answer = await call('POST', '/submissions', {
    template_id: input.templateId,
    send_email: false,
    ...(input.completedRedirectUrl ? { completed_redirect_url: input.completedRedirectUrl } : {}),
    submitters: [
      {
        name: input.name,
        email: input.email,
        external_id: input.externalId,
        send_email: false,
        ...(input.completedRedirectUrl ? { completed_redirect_url: input.completedRedirectUrl } : {}),
      },
    ],
  });
  const first = Array.isArray(answer) ? (answer[0] as { submission_id?: unknown; slug?: unknown } | undefined) : undefined;
  const submissionId = Number(first?.submission_id);
  const slug = typeof first?.slug === 'string' ? first.slug : '';
  if (!Number.isSafeInteger(submissionId) || submissionId <= 0 || !/^[A-Za-z0-9_-]{1,64}$/.test(slug)) {
    throw new DocusealError('DocuSeal created a submission but its answer has no submission id or slug', 'malformed');
  }
  if (Array.isArray(answer) && answer.length !== 1) {
    // The template has more than one signer role: not what this flow is for.
    throw new DocusealError(
      `The template has ${answer.length} signers; onboarding documents need exactly one`,
      'malformed',
      undefined,
      submissionId,
    );
  }
  return { submissionId, slug };
}

export async function getSubmission(id: number): Promise<unknown> {
  return call('GET', `/submissions/${encodeURIComponent(String(id))}`);
}

/** Best effort; never throws. */
export async function archiveSubmission(id: number): Promise<boolean> {
  try {
    await call('DELETE', `/submissions/${encodeURIComponent(String(id))}`);
    return true;
  } catch {
    return false;
  }
}
