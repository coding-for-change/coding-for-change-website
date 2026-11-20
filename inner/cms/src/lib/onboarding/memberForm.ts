/**
 * The onboarding form's answers with fixed names (documented on the
 * `onboarding` global's `form` field): what is copied to the member's
 * account and, with their consent, to their team profile. Pure, so the rules
 * are tested (memberForm.test.ts); lib/onboarding/sync.ts applies them.
 *
 *   displayName     → team.name (empty: first and last name of the account)
 *   bio             → team.bio, both languages (needed for a profile)
 *   linkedin        → a "LinkedIn" link on the profile
 *   githubUsername  → users.githubUsername, and a "GitHub" link on the profile
 *   photo           → team.image (the id the photo upload answered with)
 *   profilePublic   → "true": consent to a public profile on the Team page
 *
 * Any other question of the form is only kept on the submission.
 */

export const MEMBER_FIELDS = ['displayName', 'bio', 'linkedin', 'githubUsername', 'photo', 'profilePublic'] as const;
export type MemberField = (typeof MEMBER_FIELDS)[number];

/** The title a new profile starts with, per language, until the board sets one in the dashboard. */
export const PLACEHOLDER_TITLE = { en: 'Member', de: 'Mitglied' } as const;

export const LINK_LABELS = { linkedin: 'LinkedIn', github: 'GitHub' } as const;

const GITHUB_RE = /^[A-Za-z0-9-]{1,39}$/;
const MAX_NAME = 80;
const MAX_BIO = 1500;

export type MemberAnswers = {
  /** Only the fixed names the form actually asked; absent = not on the form. */
  present: Set<MemberField>;
  displayName: string;
  bio: string;
  linkedin: string | null;
  githubUsername: string | null;
  photo: number | null;
  profilePublic: boolean;
};

export type AnswerProblem = { field: MemberField; message: string };

/** The submission's answers by field name, as sent. */
export function answerMap(submissionData: unknown): Map<string, string> {
  const rows = Array.isArray(submissionData) ? (submissionData as { field?: unknown; value?: unknown }[]) : [];
  const out = new Map<string, string>();
  for (const row of rows) {
    if (typeof row?.field === 'string') out.set(row.field, row.value == null ? '' : String(row.value));
  }
  return out;
}

/** "octocat", "@octocat" or a github.com/octocat link → "octocat"; null when it is none of these. */
export function githubUsernameOf(raw: string): string | null {
  let v = raw.trim();
  const link = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)\/?$/i.exec(v);
  if (link) v = link[1];
  v = v.replace(/^@/, '');
  return GITHUB_RE.test(v) && !v.startsWith('-') && !v.endsWith('-') && !v.includes('--') ? v : null;
}

/**
 * A LinkedIn profile or company page as a clean https URL; null for anything
 * else (another site, a script URL, a search page).
 */
export function linkedinUrlOf(raw: string): string | null {
  let v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password || url.port) return null;
  if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null;
  const path = url.pathname.replace(/\/+$/, '');
  if (!/^\/(in|pub|company)\/[^/]+(\/.*)?$/.test(path)) return null;
  return `https://www.linkedin.com${path}`;
}

const clean = (s: string, max: number) =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);

/** The fixed-name answers, checked. `problems` lists what has to be fixed before anything is stored. */
export function readMemberAnswers(submissionData: unknown): { answers: MemberAnswers; problems: AnswerProblem[] } {
  const map = answerMap(submissionData);
  const present = new Set(MEMBER_FIELDS.filter((f) => map.has(f)));
  const problems: AnswerProblem[] = [];

  const rawGithub = (map.get('githubUsername') ?? '').trim();
  const githubUsername = rawGithub ? githubUsernameOf(rawGithub) : null;
  if (rawGithub && !githubUsername) {
    problems.push({ field: 'githubUsername', message: 'That is not a GitHub username (letters, digits and single hyphens, at most 39).' });
  }

  const rawLinkedin = (map.get('linkedin') ?? '').trim();
  const linkedin = rawLinkedin ? linkedinUrlOf(rawLinkedin) : null;
  if (rawLinkedin && !linkedin) {
    problems.push({ field: 'linkedin', message: 'That is not a LinkedIn profile link (https://www.linkedin.com/in/...).' });
  }

  const rawPhoto = (map.get('photo') ?? '').trim();
  const photo = rawPhoto && /^\d{1,12}$/.test(rawPhoto) ? Number(rawPhoto) : null;
  if (rawPhoto && photo === null) problems.push({ field: 'photo', message: 'The photo upload did not go through. Please upload it again.' });

  const profilePublic = (map.get('profilePublic') ?? '').trim() === 'true';
  const displayName = clean(map.get('displayName') ?? '', MAX_NAME);
  const bio = clean(map.get('bio') ?? '', MAX_BIO);
  if (profilePublic && !bio) {
    problems.push({ field: 'bio', message: 'A public profile needs a few words about you.' });
  }

  return {
    answers: { present, displayName, bio, linkedin, githubUsername, photo, profilePublic },
    problems,
  };
}

type Link = { id?: string | null; label: string; url: string };

/** The profile's links: ours (LinkedIn, GitHub) replaced, any the board added kept. */
export function profileLinks(existing: Link[] | null | undefined, answers: MemberAnswers): Link[] {
  const ours = new Set<string>([LINK_LABELS.linkedin, LINK_LABELS.github]);
  const kept = (existing ?? []).filter((l) => !ours.has(l.label));
  const out: Link[] = [];
  if (answers.linkedin) out.push({ label: LINK_LABELS.linkedin, url: answers.linkedin });
  if (answers.githubUsername) out.push({ label: LINK_LABELS.github, url: `https://github.com/${answers.githubUsername}` });
  return [...out, ...kept.map(({ label, url }) => ({ label, url }))];
}

export function profileName(answers: MemberAnswers, account: { firstName?: string | null; lastName?: string | null; email: string }): string {
  if (answers.displayName) return answers.displayName;
  const full = [account.firstName, account.lastName].filter(Boolean).join(' ').trim();
  return full || account.email.split('@')[0];
}
