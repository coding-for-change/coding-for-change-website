'use client';
import React from 'react';
import { Banner, useConfig } from '@payloadcms/ui';

/**
 * Above the Waitlist Signups list (admin.components.beforeListTable): mails to
 * the waitlist go out from the mailing tool now (/admin/mailing,
 * lib/mailing/), like those to the TechTour and the applicants, and each one
 * is kept.
 */
export function MailingLink() {
  const { config } = useConfig();
  return (
    <Banner type="info" to={`${config.routes.admin}/mailing`}>
      Mails to the waitlist now go out from Mailing – with a preview, a test send and every mail kept. Open Mailing →
    </Banner>
  );
}
