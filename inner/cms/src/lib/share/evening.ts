import type { Payload, PayloadRequest } from 'payload';

/**
 * One TechTour evening, as a host share link needs it: the form option the
 * registrations carry (its stable key and current label) and the TechTour
 * page's row for the same date (company, time, place). The two are matched by
 * date – the way /techtour/apply matches the rows a visitor ticks to the
 * options it stores – because the option keys predate some of the companies
 * (`wed-quantumblack` is QuantCo's evening now).
 */

export type Evening = {
  option: string;
  /** The option's label, e.g. "Wed 11 Nov · QuantCo". */
  label: string;
  /** The multi-select question the option belongs to (usually "events"). */
  field: string;
  date: Date | null;
  company: string | null;
  time: string | null;
  location: string | null;
};

type Block = {
  blockType: string;
  name?: string;
  options?: { label?: string | null; value: string }[] | null;
};

type TechTourEvent = {
  date?: string | null;
  company?: string | null;
  status?: string | null;
  time?: string | null;
  location?: string | null;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const berlinParts = (date: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

/** "Wed 11 Nov · …" → { day: 11, month: 10 }; null for any other shape. */
export const labelDay = (label?: string | null): { day: number; month: number } | null => {
  const m = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{1,2}) ([A-Z][a-z]{2})\b/.exec((label ?? '').trim());
  const month = m ? MONTHS.indexOf(m[2]) : -1;
  return m && month !== -1 ? { day: Number(m[1]), month } : null;
};

/** The first multi-select of a form – the TechTour's "which evenings". */
export const eveningsFieldOf = (fields: Block[] | null | undefined): Block | undefined =>
  (fields ?? []).find((b) => b.blockType === 'checkboxGroup' && b.name && (b.options?.length ?? 0) > 0);

export async function eveningOf(
  payload: Payload,
  formId: number | string | { id: number },
  option: string,
  req?: PayloadRequest,
): Promise<Evening | null> {
  const id = typeof formId === 'object' ? formId.id : formId;
  const form = await payload
    .findByID({ collection: 'forms', id, depth: 0, locale: 'en', req })
    .catch(() => null);
  const field = eveningsFieldOf(form?.fields as Block[] | undefined);
  const opt = field?.options?.find((o) => o.value === option);
  if (!field?.name || !opt) return null;

  const label = opt.label ?? option;
  const day = labelDay(label);
  const page = (await payload
    .findGlobal({ slug: 'tech-tour', depth: 0, locale: 'en', req })
    .catch(() => null)) as { events?: TechTourEvent[] | null } | null;
  const event = day
    ? (page?.events ?? []).find((ev) => {
        if (!ev.date) return false;
        const p = berlinParts(new Date(ev.date));
        return Number(p.day) === day.day && Number(p.month) - 1 === day.month;
      })
    : undefined;

  const tba = !event?.company?.trim() || event.status === 'tba' || /^tba$/i.test(event.company.trim());
  return {
    option,
    label,
    field: field.name,
    date: event?.date ? new Date(event.date) : null,
    company: event && !tba ? event.company!.trim() : null,
    time: event?.time?.trim() || null,
    location: event?.location?.trim() || null,
  };
}

/** Minutes Berlin is ahead of UTC at that instant (60 in winter, 120 in summer). */
const berlinOffset = (date: Date): number => {
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 60;
};

/** 23:59:59 Munich time on the Sunday of the week the evening falls in. */
export function endOfEventWeek(date: Date): Date {
  const p = berlinParts(date);
  const iso = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1;
  const sunday = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) + (7 - iso), 23, 59, 59));
  return new Date(sunday.getTime() - berlinOffset(sunday) * 60_000);
}
