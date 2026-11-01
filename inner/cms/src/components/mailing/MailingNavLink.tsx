'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import { Link, useConfig } from '@payloadcms/ui';

/**
 * Sidebar entry for the mailing tool, rendered via
 * admin.components.afterNavLinks – same markup as the review link, so it
 * picks up Payload's nav styling and active state.
 */
export function MailingNavLink() {
  const pathname = usePathname();
  const { config } = useConfig();
  const href = `${config.routes.admin}/mailing`;
  const isActive = pathname === href;

  const label = (
    <>
      {isActive && <div className="nav__link-indicator" />}
      <span className="nav__link-label">Mailing</span>
    </>
  );

  if (isActive) {
    return (
      <div className="nav__link" id="nav-mailing">
        {label}
      </div>
    );
  }
  return (
    <Link className="nav__link" href={href} id="nav-mailing" prefetch={false}>
      {label}
    </Link>
  );
}
