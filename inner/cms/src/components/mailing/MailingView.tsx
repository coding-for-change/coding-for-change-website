import type { AdminViewServerProps } from 'payload';
import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import { redirect } from 'next/navigation';
import React from 'react';
import { mailSite } from '../../endpoints/mailing';
import { MailingEditor } from './MailingEditor';
import { MailingList } from './MailingList';

/**
 * /admin/mailing – the mailing tool (lib/mailing/), registered as a custom
 * admin view in payload.config.ts: the list of mailings, or one of them with
 * `?id=`. Root custom views skip Payload's auth gate, so this guards itself.
 */
export function MailingView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { locale, permissions, req, visibleEntities } = initPageResult;
  const {
    payload,
    payload: { config },
    user,
    i18n,
  } = req;

  const adminRoute = config.routes.admin;
  if (!user) {
    redirect(`${adminRoute}${config.admin.routes.login}?redirect=${encodeURIComponent(`${adminRoute}/mailing`)}`);
  }
  const id = Number(searchParams?.id);

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
        {Number.isInteger(id) && id > 0 ? (
          <MailingEditor key={id} id={id} apiRoute={config.routes.api} adminRoute={adminRoute} site={mailSite()} />
        ) : (
          <MailingList apiRoute={config.routes.api} adminRoute={adminRoute} />
        )}
      </Gutter>
    </DefaultTemplate>
  );
}
