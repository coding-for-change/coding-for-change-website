import type { ServerProps } from 'payload';
import React from 'react';
import { googleConfig, safeRedirect } from '../../lib/googleAuth';

/**
 * "Sign in with Google" above the password form on /admin/login
 * (admin.components.beforeLogin). The password form stays below it as the
 * board's emergency access (collections/Users.ts). Nothing renders while
 * Google sign-in is not configured, so the page is then as before.
 *
 * A plain link, not a script: the flow is a full-page redirect to
 * /api/auth/google (endpoints/googleAuth.ts), carrying the login page's own
 * `?redirect=` so the user comes back where they were headed.
 */
export function GoogleLoginButton({ i18n, payload, searchParams }: ServerProps) {
  if (!googleConfig()) return null;
  const redirect = safeRedirect(typeof searchParams?.redirect === 'string' ? searchParams.redirect : null);
  const href = `${payload?.config.routes.api ?? '/api'}/auth/google${redirect ? `?${new URLSearchParams({ redirect })}` : ''}`;
  const de = i18n?.language === 'de';

  return (
    <div style={{ marginBottom: 'calc(var(--base) * 1.5)' }}>
      <a
        href={href}
        className="btn btn--style-primary btn--size-large"
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6em', width: '100%', margin: 0 }}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {de ? 'Mit Google anmelden' : 'Sign in with Google'}
      </a>
      <p style={{ marginTop: 'calc(var(--base) * 0.75)', fontSize: '0.85em', opacity: 0.75 }}>
        {de ? 'Passwort-Anmeldung nur für Admins.' : 'Password sign-in is for admins only.'}
      </p>
    </div>
  );
}
