/**
 * Reading a stored multi-select answer back into option keys. Shared by the
 * submission hook (fields/submissionRecord.ts), which records the keys on
 * arrival, and the review workspace, which falls back to it for submissions
 * older than that.
 */

export type OptionRow = { label?: string | null; value: string };

/**
 * The option keys behind a stored multi-select answer. The site sends the
 * picked labels joined by ", " in option order (CmsForm's `serialise`), so
 * they are read back in that order. Should that not add up – a label edited
 * while the visitor had the page open – each label is looked for anywhere in
 * the answer instead.
 */
export function pickedKeys(answer: string, options: OptionRow[]): string[] {
  const keys: string[] = [];
  let rest = answer.trim();
  for (const o of options) {
    const label = o.label?.trim();
    if (!label || !rest) continue;
    if (rest === label) {
      keys.push(o.value);
      rest = '';
    } else if (rest.startsWith(`${label}, `)) {
      keys.push(o.value);
      rest = rest.slice(label.length + 2);
    }
  }
  if (!rest) return keys;
  return options.filter((o) => o.label?.trim() && answer.includes(o.label.trim())).map((o) => o.value);
}
