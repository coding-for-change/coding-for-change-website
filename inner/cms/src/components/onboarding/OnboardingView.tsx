import type { AdminViewServerProps } from 'payload';
import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import { redirect } from 'next/navigation';
import React from 'react';
import { hasAdminRole } from '../../access/roles';
import { OnboardingDashboard } from './OnboardingDashboard';

/**
 * /admin/onboarding – new members from "admitted" to done, registered as a
 * custom admin view in payload.config.ts. Root custom views skip Payload's
 * auth gate, so this guards itself: no user → the admin login, a user below
 * admin → the dashboard.
 */
export function OnboardingView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { locale, permissions, req, visibleEntities } = initPageResult;
  const {
    payload,
    payload: { config },
    user,
    i18n,
  } = req;

  const adminRoute = config.routes.admin;
  if (!user) {
    redirect(`${adminRoute}${config.admin.routes.login}?redirect=${encodeURIComponent(`${adminRoute}/onboarding`)}`);
  }
  if (!hasAdminRole(user)) redirect(adminRoute);

  return (
    <DefaultTemplate
      i18n={i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <OnboardingDashboard apiRoute={config.routes.api} adminRoute={adminRoute} />
      </Gutter>
    </DefaultTemplate>
  );
}
