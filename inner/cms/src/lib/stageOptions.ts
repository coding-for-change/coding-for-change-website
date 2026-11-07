/**
 * What happened to a membership application after the written review:
 * interview held, then admitted or not – or the person withdrew. Set by hand
 * in the review workspace (/admin/review); stored in lib/stages.ts. Kept in a
 * file of its own (no imports) so the client can use it too.
 */
export const APPLICATION_STAGES = [
  { value: 'interviewed', label: 'Interview held' },
  { value: 'admitted', label: 'Admitted' },
  { value: 'not_admitted', label: 'Not admitted' },
  { value: 'withdrew', label: 'Withdrew' },
] as const;

export type ApplicationStage = (typeof APPLICATION_STAGES)[number]['value'];

export const isApplicationStage = (v: unknown): v is ApplicationStage =>
  APPLICATION_STAGES.some((s) => s.value === v);
