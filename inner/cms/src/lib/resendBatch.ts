/**
 * Mass mail through Resend's batch API: one request per 100 mails instead of
 * one per mail, so a full-list send finishes in seconds. Shared by the
 * waitlist/TechTour mail (endpoints/waitlistEmail.ts) and the mailing tool
 * (endpoints/mailing.ts), which also keeps each mail's id.
 *
 * 429/5xx/network errors are retried (up to 3 attempts per chunk, honouring
 * Retry-After); other 4xx rejections fail the whole chunk – Resend validates
 * a batch atomically, so one bad address fails its chunk. With `idempotencyKey`
 * every chunk carries `<key>-<n>`, so a retry after a lost answer cannot send
 * the chunk twice.
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
    const failAll = (error: string) => results.push(...chunk.map(() => ({ error })));
    if (i > 0) await sleep(BATCH_INTERVAL_MS);
    for (let attempt = 1; ; attempt += 1) {
      let res: Response;
      try {
        res = await fetch(BATCH_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            ...(idempotencyKey ? { 'Idempotency-Key': `${idempotencyKey}-${i / BATCH_SIZE}` } : {}),
          },
          body: JSON.stringify(chunk),
        });
      } catch (err) {
        if (attempt < 3) {
          await sleep(1000 * attempt);
          continue;
        }
        failAll(err instanceof Error ? err.message : 'network error');
        break;
      }
      if (res.ok) {
        const body = (await res.json().catch(() => null)) as { data?: { id?: string }[] } | null;
        results.push(...chunk.map((_, k) => ({ id: body?.data?.[k]?.id })));
        break;
      }
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        const after = Number(res.headers.get('retry-after'));
        await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : 1000 * attempt);
        continue;
      }
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      failAll(`Resend ${res.status}${detail ? `: ${detail}` : ''}`);
      break;
    }
  }
  return results;
}
