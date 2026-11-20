import type { AdminViewServerProps } from 'payload';
import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import { redirect } from 'next/navigation';
import React from 'react';
import { hasAdminRole, hasEditorRole } from '../../access/roles';
import { AnalyticsDashboardClient } from './AnalyticsDashboardClient';
import './dashboard.css';

/**
 * /admin/analytics — first-party analytics dashboard, registered as a custom
 * admin view in payload.config.ts. Root custom views skip Payload's auth
 * gate, so this guards itself: no user → bounce to the admin login, a member
 * → the dashboard. Editors see it all except the signups export (addresses).
 */
export function AnalyticsDashboardView({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const { locale, permissions, req, visibleEntities } = initPageResult;
  const {
    payload,
    payload: { config },
    user,
    i18n,
  } = req;

  const adminRoute = config.routes.admin;
  if (!user) {
    redirect(
      `${adminRoute}${config.admin.routes.login}?redirect=${encodeURIComponent(
        `${adminRoute}/analytics`,
      )}`,
    );
  }
  if (!hasEditorRole(user)) redirect(adminRoute);

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
        <AnalyticsDashboardClient apiRoute={config.routes.api} canExportSignups={hasAdminRole(user)} />
      </Gutter>
    </DefaultTemplate>
  );
}
