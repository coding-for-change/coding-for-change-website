import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADMIN_EMAILS,
  adminEmails,
  authorizationUrl,
  checkIdClaims,
  decodeOAuthState,
  encodeOAuthState,
  googleConfig,
  landingFor,
  newOAuthState,
  pkceChallenge,
  roleAfterSignIn,
  safeRedirect,
} from './googleAuth';

describe('safeRedirect', () => {
  it('keeps paths on this site', () => {
    expect(safeRedirect('/admin')).toBe('/admin');
    expect(safeRedirect('/onboarding')).toBe('/onboarding');
    expect(safeRedirect('/admin/collections/team?limit=10#top')).toBe('/admin/collections/team?limit=10#top');
    expect(safeRedirect('/')).toBe('/');
  });

  it('normalises dot segments without leaving the site', () => {
    expect(safeRedirect('/a/../admin')).toBe('/admin');
    expect(safeRedirect('/../../admin')).toBe('/admin');
  });

  it('refuses other hosts and schemes', () => {
    for (const bad of [
      '//evil.com',
      '//evil.com/admin',
      '///evil.com',
      'https://evil.com',
      'http://evil.com/admin',
      'javascript:alert(1)',
      'evil.com',
      'admin',
      '',
      ' /admin',
    ]) {
      expect(safeRedirect(bad), bad).toBeNull();
    }
  });

  it('refuses backslashes, encoded slashes and control characters', () => {
    for (const bad of ['/\\evil.com', '/\\/evil.com', '\\\\evil.com', '/%5cevil.com', '/%5Cevil.com', '/%2F%2Fevil.com', '/admin\r\nSet-Cookie: x=1', '/a\tb', '/a b']) {
      expect(safeRedirect(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('refuses anything that is not a string, or too long', () => {
    expect(safeRedirect(undefined)).toBeNull();
    expect(safeRedirect(null)).toBeNull();
    expect(safeRedirect(['/admin'])).toBeNull();
    expect(safeRedirect(`/${'a'.repeat(3000)}`)).toBeNull();
  });
});

describe('landingFor', () => {
  it('editors and admins go to the admin panel unless asked otherwise', () => {
    expect(landingFor('admin', null)).toBe('/admin');
    expect(landingFor('editor', null)).toBe('/admin');
    expect(landingFor('editor', '/admin/collections/team')).toBe('/admin/collections/team');
    expect(landingFor('admin', '/onboarding')).toBe('/onboarding');
  });

  it('members go to the onboarding page, never into the admin panel', () => {
    expect(landingFor('member', null)).toBe('/onboarding');
    expect(landingFor('member', '/admin')).toBe('/onboarding');
    expect(landingFor('member', '/admin/collections/users')).toBe('/onboarding');
    expect(landingFor('member', '/admin?x=1')).toBe('/onboarding');
    expect(landingFor('member', '/onboarding?step=2')).toBe('/onboarding?step=2');
    expect(landingFor('member', '/administration')).toBe('/administration');
  });
});

describe('roleAfterSignIn and ADMIN_EMAILS', () => {
  const admins = ['info@codingforchange.com', 'jakob.landbrecht@codingforchange.com'];

  it('new accounts are members unless on the admin list', () => {
    expect(roleAfterSignIn('new.person@codingforchange.com', null, admins)).toBe('member');
    expect(roleAfterSignIn('info@codingforchange.com', null, admins)).toBe('admin');
    expect(roleAfterSignIn('INFO@codingforchange.com', null, admins)).toBe('admin');
  });

  it('existing accounts keep their role, the admin list promotes', () => {
    expect(roleAfterSignIn('a@codingforchange.com', 'editor', admins)).toBe('editor');
    expect(roleAfterSignIn('a@codingforchange.com', 'admin', admins)).toBe('admin');
    expect(roleAfterSignIn('jakob.landbrecht@codingforchange.com', 'member', admins)).toBe('admin');
  });

  it('reads ADMIN_EMAILS, with the two first admins as default', () => {
    expect(adminEmails({})).toEqual(DEFAULT_ADMIN_EMAILS);
    expect(adminEmails({ ADMIN_EMAILS: '  ' })).toEqual(DEFAULT_ADMIN_EMAILS);
    expect(adminEmails({ ADMIN_EMAILS: ' A@x.org, b@x.org ,,' })).toEqual(['a@x.org', 'b@x.org']);
  });
});

describe('googleConfig', () => {
  it('is off unless client id, secret and domain are all set', () => {
    expect(googleConfig({})).toBeNull();
    expect(googleConfig({ GOOGLE_OAUTH_CLIENT_ID: 'id', GOOGLE_OAUTH_CLIENT_SECRET: 'secret' })).toBeNull();
    expect(
      googleConfig({ GOOGLE_OAUTH_CLIENT_ID: 'id', GOOGLE_OAUTH_CLIENT_SECRET: 'secret', GOOGLE_ALLOWED_DOMAIN: 'CodingForChange.com' }),
    ).toEqual({ clientId: 'id', clientSecret: 'secret', allowedDomain: 'codingforchange.com' });
  });
});

describe('state cookie and PKCE', () => {
  it('round-trips, and refuses tampering and expiry', () => {
    const now = 1_700_000_000_000;
    const s = newOAuthState('/admin', now);
    const value = encodeOAuthState(s);
    expect(decodeOAuthState(value, now)).toEqual(s);

    const [payload, sig] = value.split('.');
    const forged = Buffer.from(JSON.stringify({ s: 'x', v: 'y', n: 'z', r: '/admin', x: now + 1e6 })).toString('base64url');
    expect(decodeOAuthState(`${forged}.${sig}`, now)).toBeNull();
    expect(decodeOAuthState(`${payload}.${sig}x`, now)).toBeNull();
    expect(decodeOAuthState(`${payload}`, now)).toBeNull();
    expect(decodeOAuthState(undefined, now)).toBeNull();
    expect(decodeOAuthState(value, s.expires + 1)).toBeNull();
  });

  it('makes a fresh state, verifier and nonce every time', () => {
    const a = newOAuthState(null);
    const b = newOAuthState(null);
    expect(a.state).not.toBe(b.state);
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('uses S256 for the challenge', () => {
    const verifier = 'a-verifier-of-sufficient-length-0123456789abc';
    expect(pkceChallenge(verifier)).toBe(createHash('sha256').update(verifier).digest('base64url'));
    expect(pkceChallenge(verifier)).not.toContain('=');
  });

  it('sends state, PKCE, nonce and hd to Google', () => {
    const s = newOAuthState(null);
    const url = new URL(authorizationUrl({ clientId: 'cid', clientSecret: 'sec', allowedDomain: 'codingforchange.com' }, 'https://site/cb', s));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    const q = Object.fromEntries(url.searchParams);
    expect(q).toMatchObject({
      client_id: 'cid',
      redirect_uri: 'https://site/cb',
      response_type: 'code',
      state: s.state,
      nonce: s.nonce,
      code_challenge: pkceChallenge(s.verifier),
      code_challenge_method: 'S256',
      hd: 'codingforchange.com',
    });
    expect(q.client_secret).toBeUndefined();
    expect(url.href).not.toContain(s.verifier);
  });
});

describe('checkIdClaims', () => {
  const now = 1_700_000_000_000;
  const expected = { clientId: 'cid', allowedDomain: 'codingforchange.com', nonce: 'n0nce' };
  const good = {
    iss: 'https://accounts.google.com',
    aud: 'cid',
    exp: now / 1000 + 600,
    nonce: 'n0nce',
    email: 'Jane.Doe@codingforchange.com',
    email_verified: true,
    hd: 'codingforchange.com',
    name: 'Jane Doe',
  };
  const reason = (claims: Record<string, unknown>) => {
    const r = checkIdClaims(claims, expected, now);
    return r.ok ? 'ok' : r.reason;
  };

  it('accepts a verified address of the domain, lower-cased', () => {
    expect(checkIdClaims(good, expected, now)).toEqual({ ok: true, email: 'jane.doe@codingforchange.com', name: 'Jane Doe' });
    expect(reason({ ...good, iss: 'accounts.google.com' })).toBe('ok');
  });

  it('refuses the wrong issuer, audience, expiry or nonce', () => {
    expect(reason({ ...good, iss: 'https://evil.example' })).toBe('issuer');
    expect(reason({ ...good, aud: 'other-client' })).toBe('audience');
    expect(reason({ ...good, aud: ['other', 'cid'] })).toBe('audience');
    expect(reason({ ...good, aud: ['other', 'cid'], azp: 'cid' })).toBe('ok');
    expect(reason({ ...good, exp: now / 1000 - 1 })).toBe('expired');
    expect(reason({ ...good, exp: undefined })).toBe('expired');
    expect(reason({ ...good, nonce: 'other' })).toBe('nonce');
    expect(reason({ ...good, nonce: undefined })).toBe('nonce');
  });

  it('refuses unverified addresses', () => {
    expect(reason({ ...good, email_verified: false })).toBe('email-unverified');
    expect(reason({ ...good, email_verified: 'true' })).toBe('email-unverified');
  });

  it('refuses other domains and private accounts', () => {
    expect(reason({ ...good, hd: undefined })).toBe('domain');
    expect(reason({ ...good, hd: 'gmail.com', email: 'jane@gmail.com' })).toBe('domain');
    expect(reason({ ...good, hd: 'other.org' })).toBe('domain');
    expect(reason({ ...good, email: 'jane@other.org' })).toBe('domain');
    expect(reason({ ...good, email: 'jane@evil-codingforchange.com' })).toBe('domain');
    expect(reason({ ...good, email: undefined })).toBe('domain');
  });
});
