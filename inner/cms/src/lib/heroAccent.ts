import sharp from 'sharp';

/**
 * Dominant-accent extraction for a mail's header image
 * (lib/waitlistEmailTemplate.ts renders the image as a card on a tinted
 * band; endpoints/mailing.ts calls this so the tint adapts to the
 * artwork, the way chat apps tint their link previews).
 *
 * The naive dominant color of event artwork is useless — posters are mostly
 * white background — so pixels are filtered to the actually-colorful ones
 * (saturation ≥ 0.18, mid lightness) before picking the most common hue
 * bucket. The result is just { hue, sat }: the template owns lightness, so
 * the band always stays in its soft pastel range no matter how loud the
 * artwork is.
 *
 * Returns null (→ template falls back to its neutral stone band) when the
 * image can't be fetched/decoded in time, is huge, or simply has no colorful
 * area worth echoing (< 2% of pixels, e.g. black-and-white artwork).
 * Results are memoized per URL — the live preview re-renders on every
 * keystroke and must not re-download the image each time.
 */

export type HeroAccent = { hue: number; sat: number };

const FETCH_TIMEOUT_MS = 5000;
const MAX_IMAGE_BYTES = 15_000_000;
const SAMPLE_SIZE = 64; // decoded thumbnail edge — plenty for a histogram
const MIN_COLORFUL_FRACTION = 0.02;
const HUE_BUCKETS = 24; // 15° each

const cache = new Map<string, HeroAccent | null>();
const CACHE_MAX = 50;

const remember = (url: string, accent: HeroAccent | null): HeroAccent | null => {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(url, accent);
  return accent;
};

/** h in [0,360), s and l in [0,1] — standard RGB→HSL. */
const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s, l };
};

export async function extractHeroAccent(imageUrl: string): Promise<HeroAccent | null> {
  const hit = cache.get(imageUrl);
  if (hit !== undefined) return hit;

  let bytes: Buffer;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(imageUrl, { signal: ctrl.signal, redirect: 'follow' });
      if (!res.ok) return remember(imageUrl, null);
      const declared = Number(res.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) return remember(imageUrl, null);
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_IMAGE_BYTES) return remember(imageUrl, null);
      bytes = Buffer.from(buf);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return remember(imageUrl, null);
  }

  try {
    const { data, info } = await sharp(bytes)
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = info.width * info.height;
    // Per-bucket tallies plus hue as a vector (cos/sin sums), so the mean
    // hue is correct even in the bucket that straddles 0°/360°.
    const count = new Array<number>(HUE_BUCKETS).fill(0);
    const cos = new Array<number>(HUE_BUCKETS).fill(0);
    const sin = new Array<number>(HUE_BUCKETS).fill(0);
    const sat = new Array<number>(HUE_BUCKETS).fill(0);
    let colorful = 0;

    for (let i = 0; i < pixels; i += 1) {
      const o = i * info.channels;
      if (info.channels === 4 && data[o + 3] < 128) continue;
      const { h, s, l } = rgbToHsl(data[o], data[o + 1], data[o + 2]);
      if (s < 0.18 || l < 0.12 || l > 0.88) continue;
      colorful += 1;
      const bucket = Math.min(HUE_BUCKETS - 1, Math.floor(h / (360 / HUE_BUCKETS)));
      count[bucket] += 1;
      const rad = (h * Math.PI) / 180;
      cos[bucket] += Math.cos(rad);
      sin[bucket] += Math.sin(rad);
      sat[bucket] += s;
    }

    if (colorful / pixels < MIN_COLORFUL_FRACTION) return remember(imageUrl, null);
    let top = 0;
    for (let b = 1; b < HUE_BUCKETS; b += 1) if (count[b] > count[top]) top = b;
    if (count[top] === 0) return remember(imageUrl, null);

    const hue = (Math.atan2(sin[top] / count[top], cos[top] / count[top]) * 180) / Math.PI;
    return remember(imageUrl, {
      hue: (hue + 360) % 360,
      sat: sat[top] / count[top],
    });
  } catch {
    return remember(imageUrl, null);
  }
}
