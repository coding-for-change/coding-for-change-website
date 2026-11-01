/**
 * Mass mail through Resend's batch API: one request per 100 mails instead of
 * one per mail, so a full-list send finishes in seconds. Used by the mailing
 * tool (endpoints/mailing.ts), which keeps each mail's id.
 *
 * 429/5xx/network errors are retried (up to 3 attempts per chunk, honouring
 * Retry-After). Resend validates a batch as a whole, so one address it refuses
 * (400/422) fails its chunk: such a chunk is then sent again one mail at a
 * time, so only the bad address fails and the others go out. With
 * `idempotencyKey` every request carries `<key>-<n>` (`<key>-<n>-<k>` for a
 * single mail), so a retry after a lost answer cannot send a mail twice.
 */

export type BatchItem = {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
};

/** Per item, in order: the provider's id, or why it failed. */
export type BatchResult = { id?: string; error?: string };

const BATCH_URL = 'https://api.resend.com/emails/batch';
const BATCH_SIZE = 100; // Resend's maximum per batch request
const BATCH_INTERVAL_MS = 600; // stay under Resend's default 2 requests/second

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function sendResendBatch(
  apiKey: string,
  items: BatchItem[],
  idempotencyKey?: string,
): Promise<BatchResult[]> {
  const results: BatchResult[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const key = idempotencyKey ? `${idempotencyKey}-${i / BATCH_SIZE}` : undefined;
    if (i > 0) await sleep(BATCH_INTERVAL_MS);
    const outcome = await postBatch(apiKey, chunk, key);
    if (outcome.refused && chunk.length > 1) {
      for (let k = 0; k < chunk.length; k += 1) {
        await sleep(BATCH_INTERVAL_MS);
        const single = await postBatch(apiKey, [chunk[k]], key ? `${key}-${k}` : undefined);
        results.push(single.results[0]);
      }
    } else {
      results.push(...outcome.results);
    }
  }
  return results;
}

/** One batch request with retries; `refused` when Resend turned the content down (400/422). */
async function postBatch(
  apiKey: string,
  chunk: BatchItem[],
  idempotencyKey?: string,
): Promise<{ results: BatchResult[]; refused: boolean }> {
  const failAll = (error: string, refused = false) => ({ results: chunk.map(() => ({ error })), refused });
  for (let attempt = 1; ; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(BATCH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: JSON.stringify(chunk),
      });
    } catch (err) {
      if (attempt < 3) {
        await sleep(1000 * attempt);
        continue;
      }
      return failAll(err instanceof Error ? err.message : 'network error');
    }
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as { data?: { id?: string }[] } | null;
      return { results: chunk.map((_, k) => ({ id: body?.data?.[k]?.id })), refused: false };
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const after = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : 1000 * attempt);
      continue;
    }
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    return failAll(`Resend ${res.status}${detail ? `: ${detail}` : ''}`, res.status === 400 || res.status === 422);
  }
}
