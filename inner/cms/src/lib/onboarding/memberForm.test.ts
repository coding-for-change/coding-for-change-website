import { describe, expect, it } from 'vitest';
import { githubUsernameOf, linkedinUrlOf, profileLinks, profileName, readMemberAnswers } from './memberForm';

const sent = (answers: Record<string, string>) => Object.entries(answers).map(([field, value]) => ({ field, value }));

describe('githubUsernameOf', () => {
  it('takes a plain name, an @name or a profile link', () => {
    expect(githubUsernameOf('octocat')).toBe('octocat');
    expect(githubUsernameOf(' @Octo-Cat ')).toBe('Octo-Cat');
    expect(githubUsernameOf('https://github.com/octocat/')).toBe('octocat');
    expect(githubUsernameOf('github.com/octocat')).toBe('octocat');
  });

  it('refuses anything GitHub would not allow', () => {
    for (const bad of ['', 'a'.repeat(40), 'octo cat', 'octo_cat', '-octo', 'octo-', 'oc--to', 'octo/cat', '<script>', 'https://gitlab.com/x']) {
      expect(githubUsernameOf(bad)).toBeNull();
    }
    expect(githubUsernameOf('a'.repeat(39))).toBe('a'.repeat(39));
  });
});

describe('linkedinUrlOf', () => {
  it('cleans a profile link', () => {
    expect(linkedinUrlOf('https://www.linkedin.com/in/max-mustermann/')).toBe('https://www.linkedin.com/in/max-mustermann');
    expect(linkedinUrlOf('linkedin.com/in/max?utm=1')).toBe('https://www.linkedin.com/in/max');
    expect(linkedinUrlOf('https://de.linkedin.com/in/max')).toBe('https://www.linkedin.com/in/max');
  });

  it('refuses other sites, schemes and pages', () => {
    for (const bad of [
      'javascript:alert(1)',
      'https://evil.com/in/max',
      'https://linkedin.com.evil.com/in/max',
      'https://www.linkedin.com/feed/',
      'https://user:pw@www.linkedin.com/in/max',
      'max mustermann',
    ]) {
      expect(linkedinUrlOf(bad)).toBeNull();
    }
  });
});

describe('readMemberAnswers', () => {
  it('reads the fixed names and knows which the form asked', () => {
    const { answers, problems } = readMemberAnswers(
      sent({ displayName: ' Max ', bio: 'Hi', githubUsername: 'octocat', photo: '12', profilePublic: 'true', other: 'x' }),
    );
    expect(problems).toEqual([]);
    expect(answers).toMatchObject({ displayName: 'Max', bio: 'Hi', githubUsername: 'octocat', photo: 12, profilePublic: true, linkedin: null });
    expect([...answers.present].sort()).toEqual(['bio', 'displayName', 'githubUsername', 'photo', 'profilePublic']);
  });

  it('lists every wrong answer', () => {
    const { problems } = readMemberAnswers(sent({ githubUsername: 'no way', linkedin: 'https://evil.com', photo: 'x.png', profilePublic: 'true', bio: ' ' }));
    expect(problems.map((p) => p.field).sort()).toEqual(['bio', 'githubUsername', 'linkedin', 'photo']);
  });

  it('needs no bio without consent, and an unticked box is no consent', () => {
    const { answers, problems } = readMemberAnswers(sent({ profilePublic: 'false' }));
    expect(problems).toEqual([]);
    expect(answers.profilePublic).toBe(false);
  });
});

describe('profileLinks and profileName', () => {
  const answers = readMemberAnswers(sent({ linkedin: 'linkedin.com/in/max', githubUsername: 'octocat' })).answers;

  it('replaces our links and keeps the board\'s', () => {
    const links = profileLinks(
      [
        { label: 'LinkedIn', url: 'https://www.linkedin.com/in/old' },
        { label: 'Website', url: 'https://max.dev' },
      ],
      answers,
    );
    expect(links).toEqual([
      { label: 'LinkedIn', url: 'https://www.linkedin.com/in/max' },
      { label: 'GitHub', url: 'https://github.com/octocat' },
      { label: 'Website', url: 'https://max.dev' },
    ]);
  });

  it('falls back to the account name', () => {
    expect(profileName(answers, { firstName: 'Max', lastName: 'Mustermann', email: 'max@x.org' })).toBe('Max Mustermann');
    expect(profileName(answers, { email: 'max.m@x.org' })).toBe('max.m');
  });
});
