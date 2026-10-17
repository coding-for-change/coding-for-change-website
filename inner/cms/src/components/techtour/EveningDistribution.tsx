import type { Payload, UIFieldServerComponent } from 'payload';
import React from 'react';
import { pickedKeys, type OptionRow } from '../../lib/choiceKeys';
import { eveningsFieldOf } from '../../lib/share/evening';
import './evening-distribution.css';

/**
 * "Registrations per evening" on the TechTour page in the admin: how many
 * registrations picked each evening, most first, with the share of all
 * registrations as the bar. A UI field (globals/TechTour.ts) – nothing is
 * stored, it is counted afresh each time the page opens or is saved.
 *
 * An evening is counted by the option keys a registration recorded on arrival
 * (`choiceKeys`, fields/submissionRecord.ts); one older than that is read back
 * from its answer against the labels in both languages, the way the host share
 * links do (lib/share/registrations.ts).
 */

const TECHTOUR_FORM_TITLE = 'techtour';

type Block = { blockType: string; name?: string; options?: OptionRow[] | null };

type Row = { key: string; label: string; count: number };

type Tally = { registrations: number; picks: number; withoutEvening: number; rows: Row[] };

async function tally(payload: Payload, user: unknown): Promise<Tally | null> {
  // Not with `req`: a local-API read with a `locale` writes it onto the
  // request (see lib/share/registrations.ts).
  const forms = await payload.find({ collection: 'forms', limit: 100, depth: 0, locale: 'en' });
  const form = forms.docs.find((f) => f.title?.trim().toLowerCase() === TECHTOUR_FORM_TITLE);
  if (!form) return null;
  const field = eveningsFieldOf(form.fields as Block[]);
  if (!field?.name) return null;
  const options = field.options ?? [];
  const de = await payload.findByID({ collection: 'forms', id: form.id, depth: 0, locale: 'de' }).catch(() => null);
  const optionsDe = eveningsFieldOf((de?.fields ?? []) as Block[])?.options ?? [];

  const { docs } = await payload.find({
    collection: 'form-submissions',
    where: { form: { equals: form.id } },
    depth: 0,
    pagination: false,
    select: { submissionData: true, choiceKeys: true },
    overrideAccess: false,
    user: user as never,
  });

  const counts = new Map<string, number>();
  let picks = 0;
  let withoutEvening = 0;
  for (const s of docs) {
    const recorded = (s.choiceKeys as Record<string, unknown> | null | undefined)?.[field.name];
    const answer = (s.submissionData ?? []).find((kv) => kv.field === field.name)?.value ?? '';
    const keys = new Set(
      Array.isArray(recorded)
        ? (recorded as string[])
        : [...pickedKeys(answer, options), ...pickedKeys(answer, optionsDe)],
    );
    if (keys.size === 0) withoutEvening += 1;
    for (const key of keys) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      picks += 1;
    }
  }

  // Every evening on the form, also one nobody picked yet; a key the form no
  // longer has still counts, under its key.
  const rows: Row[] = options.map((o) => ({ key: o.value, label: o.label?.trim() || o.value, count: counts.get(o.value) ?? 0 }));
  for (const [key, count] of counts) {
    if (!options.some((o) => o.value === key)) rows.push({ key, label: `${key} (no longer on the form)`, count });
  }
  // Most first; a tie keeps the form's (date) order.
  const order = new Map(rows.map((r, i) => [r.key, i]));
  rows.sort((a, b) => b.count - a.count || order.get(a.key)! - order.get(b.key)!);
  return { registrations: docs.length, picks, withoutEvening, rows };
}

/** "1 registration", "23 registrations" – the number never wraps away from its word. */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export const EveningDistribution: UIFieldServerComponent = async ({ payload, user }) => {
  let data: Tally | null;
  try {
    data = await tally(payload, user);
  } catch (err) {
    payload.logger.error(err, '[techtour] could not count the registrations per evening');
    data = null;
  }

  const n = data?.registrations ?? 0;
  const perPerson = n ? (data!.picks / n).toFixed(1) : null;

  return (
    <div className="field-type tt-evenings">
      <header className="tt-evenings__header">
        <h3 className="tt-evenings__title">Registrations per evening</h3>
        {data && (
          <span className="tt-evenings__total">
            {plural(n, 'registration', 'registrations')}
            {perPerson && ` · ${perPerson} evenings each on average`}
          </span>
        )}
      </header>

      {!data && <p className="tt-evenings__empty">Could not count the registrations – there is no form titled "techtour" with a choice of evenings.</p>}

      {data && (
        <ol className="tt-evenings__rows">
          {data.rows.map((row) => {
            const share = percent(row.count, n);
            return (
              <li
                key={row.key}
                className="tt-evenings__row"
                title={`${row.label}: ${row.count} of ${plural(n, 'registration', 'registrations')} (${share}%)`}
              >
                <span className="tt-evenings__label">{row.label}</span>
                <span className="tt-evenings__track" aria-hidden="true">
                  <span className="tt-evenings__bar" style={{ width: `${share}%` }} />
                </span>
                <span className="tt-evenings__value">
                  <span className="tt-evenings__count">{row.count}</span>
                  <span className="tt-evenings__share">{share}%</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {data && (
        <div className="field-description">
          {n === 0
            ? 'No registrations yet.'
            : `Most registrations first. The bar is the share of all registrations that picked the evening – one registration can pick several, so the shares can add up to more than 100%. Counts every registration, whatever its review decision.${
                data.withoutEvening ? ` ${plural(data.withoutEvening, 'registration picked', 'registrations picked')} no evening.` : ''
              }`}
        </div>
      )}
    </div>
  );
};
