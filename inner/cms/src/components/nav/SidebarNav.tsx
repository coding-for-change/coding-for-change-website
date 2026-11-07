'use client';
import { Link, NavGroup } from '@payloadcms/ui';
import { usePathname, useSearchParams } from 'next/navigation';
import React from 'react';
import type { NavIconName } from '../../lib/adminNav';
import { FALLBACK_ICON, NAV_ICONS } from './icons';

export type SidebarItem = {
  id: string;
  href: string;
  /** The page's path, without the query. */
  path: string;
  /** For a view opened on one tab (the review workspace's `?form=`). */
  query?: Record<string, string>;
  label: string;
  icon?: NavIconName;
};

export type SidebarSection = { label: string; isOpen?: boolean; items: SidebarItem[] };

/** The sections and links of the sidebar; Nav.tsx puts them in Payload's frame. */
export function SidebarNav({ sections }: { sections: SidebarSection[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryMatches = (item: SidebarItem) =>
    Object.entries(item.query ?? {}).every(([key, value]) => searchParams.get(key) === value);
  // A list stays marked while one of its documents is open, as in Payload's nav.
  const isActive = (item: SidebarItem) =>
    item.query
      ? pathname === item.path && queryMatches(item)
      : pathname.startsWith(item.path) && ['/', undefined].includes(pathname[item.path.length]);
  const isCurrentPage = (item: SidebarItem) => pathname === item.path && queryMatches(item);

  return (
    <>
      {sections.map((section) => (
        <NavGroup key={section.label} label={section.label} isOpen={section.isOpen}>
          <ul className="cfc-nav__list">
            {section.items.map((item) => {
              const Icon = item.icon ? NAV_ICONS[item.icon] : FALLBACK_ICON;
              const active = isActive(item);
              const className = `cfc-nav__item${active ? ' cfc-nav__item--active' : ''}`;
              const content = (
                <>
                  <Icon className="cfc-nav__icon" size={16} strokeWidth={1.75} aria-hidden />
                  <span className="cfc-nav__label">{item.label}</span>
                </>
              );
              return (
                <li key={item.id}>
                  {isCurrentPage(item) ? (
                    <div className={className} id={item.id} aria-current="page">
                      {content}
                    </div>
                  ) : (
                    <Link className={className} href={item.href} id={item.id} prefetch={false}>
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </NavGroup>
      ))}
    </>
  );
}
