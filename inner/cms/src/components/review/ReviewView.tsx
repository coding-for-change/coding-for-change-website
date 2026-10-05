import type { AdminViewServerProps } from 'payload';
import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import { redirect } from 'next/navigation';
import React from 'react';
import { ReviewWorkspace } from './ReviewWorkspace';

/**
 * /admin/review – the review workspace, registered as a custom admin view in
 * payload.config.ts. Root custom views skip Payload's auth gate, so this
 * guards itself: no user → bounce to the admin login, then back here.
 */
export function ReviewView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { locale, permissions, req, visibleEntities } = initPageResult;
  const {
    payload,
    payload: { config },
    user,
    i18n,
  } = req;

  const adminRoute = config.routes.admin;
  if (!user) {
    redirect(`${adminRoute}${config.admin.routes.login}?redirect=${encodeURIComponent(`${adminRoute}/review`)}`);
  }

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
        <ReviewWorkspace apiRoute={config.routes.api} />
      </Gutter>
    </DefaultTemplate>
  );
}
