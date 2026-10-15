'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import { Link, useConfig } from '@payloadcms/ui';

/**
 * Sidebar entry for the review workspace, rendered via
 * admin.components.afterNavLinks – same markup as the analytics link, so it
 * picks up Payload's nav styling and active state.
 */
export function ReviewNavLink() {
  const pathname = usePathname();
  const { config } = useConfig();
  const href = `${config.routes.admin}/review`;
  const isActive = pathname === href;

  const label = (
    <>
      {isActive && <div className="nav__link-indicator" />}
      <span className="nav__link-label">Review applications</span>
    </>
  );

  if (isActive) {
    return (
      <div className="nav__link" id="nav-review">
        {label}
      </div>
    );
  }
  return (
    <Link className="nav__link" href={href} id="nav-review" prefetch={false}>
      {label}
    </Link>
  );
}
