import { NavHamburger, NavWrapper } from '@payloadcms/next/client';
import { Logout } from '@payloadcms/ui';
import type { SanitizedCollectionConfig, SanitizedGlobalConfig, ServerProps } from 'payload';
import { formatAdminURL, PREFERENCE_KEYS } from 'payload/shared';
import React from 'react';
import { ADMIN_NAV } from '../../lib/adminNav';
import { SidebarNav, type SidebarItem, type SidebarSection } from './SidebarNav';
import './nav.css';

type NavPrefs = { groups?: Record<string, { open?: boolean }> };

/** A collection's or global's label as written in the config (string, per-language or function). */
const labelText = (label: unknown, i18n: ServerProps['i18n'], fallback: string): string => {
  if (typeof label === 'string') return label;
  if (typeof label === 'function') return String(label({ i18n, t: i18n.t }));
  if (label && typeof label === 'object') {
    const byLanguage = label as Record<string, string>;
    return byLanguage[i18n.language] ?? Object.values(byLanguage)[0] ?? fallback;
  }
  return fallback;
};

/**
 * The admin sidebar (admin.components.Nav), in place of Payload's own: the
 * sections of lib/adminNav.ts with an icon per entry, our admin views
 * (review, mailing, analytics) inside the sections they belong to. The frame –
 * wrapper, hamburger, log-out – is Payload's, so opening, closing and the
 * mobile drawer behave as before; a section folded away stays folded, in the
 * same per-user preference Payload keeps.
 *
 * Shows only what the user may read, like Payload's nav.
 */
export async function Nav({ i18n, payload, permissions, user, visibleEntities }: ServerProps) {
  if (!payload?.config) return null;
  const { config } = payload;
  const adminRoute = config.routes.admin;

  const collections = new Map<string, SanitizedCollectionConfig>(
    config.collections
      .filter(
        (c) =>
          visibleEntities?.collections.includes(c.slug) &&
          permissions?.collections?.[c.slug]?.read &&
          c.admin?.group !== false,
      )
      .map((c) => [c.slug, c]),
  );
  const globals = new Map<string, SanitizedGlobalConfig>(
    config.globals
      .filter(
        (g) =>
          visibleEntities?.globals.includes(g.slug) &&
          permissions?.globals?.[g.slug]?.read &&
          g.admin?.group !== false,
      )
      .map((g) => [g.slug, g]),
  );

  const collectionItem = (slug: string, icon?: SidebarItem['icon']): SidebarItem => {
    const path = formatAdminURL({ adminRoute, path: `/collections/${slug}` });
    return { id: `nav-${slug}`, href: path, path, label: labelText(collections.get(slug)?.labels.plural, i18n, slug), icon };
  };
  const globalItem = (slug: string, icon?: SidebarItem['icon']): SidebarItem => {
    const path = formatAdminURL({ adminRoute, path: `/globals/${slug}` });
    return { id: `nav-global-${slug}`, href: path, path, label: labelText(globals.get(slug)?.label, i18n, slug), icon };
  };

  const listed = new Set<string>();
  const sections: Omit<SidebarSection, 'isOpen'>[] = ADMIN_NAV.map((section) => ({
    label: section.label,
    items: section.items.flatMap((item): SidebarItem[] => {
      if ('collection' in item) {
        listed.add(`c:${item.collection}`);
        return collections.has(item.collection) ? [collectionItem(item.collection, item.icon)] : [];
      }
      if ('global' in item) {
        listed.add(`g:${item.global}`);
        return globals.has(item.global) ? [globalItem(item.global, item.icon)] : [];
      }
      const path = formatAdminURL({ adminRoute, path: item.view });
      const query = item.query ? `?${new URLSearchParams(item.query)}` : '';
      const id = ['nav', item.view.replace(/\W+/g, ''), ...Object.values(item.query ?? {})].join('-');
      return [{ id, href: `${path}${query}`, path, query: item.query, label: item.label, icon: item.icon }];
    }),
  }));

  // Anything added later and not yet placed in lib/adminNav.ts: under its own group.
  const extra = new Map<string, SidebarItem[]>();
  const addExtra = (group: unknown, fallback: string, item: SidebarItem) => {
    const label = labelText(group, i18n, fallback);
    const section = sections.find((s) => s.label === label);
    if (section) section.items.push(item);
    else extra.set(label, [...(extra.get(label) ?? []), item]);
  };
  for (const [slug, c] of collections) {
    if (!listed.has(`c:${slug}`)) addExtra(c.admin?.group, i18n.t('general:collections'), collectionItem(slug));
  }
  for (const [slug, g] of globals) {
    if (!listed.has(`g:${slug}`)) addExtra(g.admin?.group, i18n.t('general:globals'), globalItem(slug));
  }

  const prefs: NavPrefs | undefined = user
    ? await payload
        .find({
          collection: 'payload-preferences',
          depth: 0,
          limit: 1,
          pagination: false,
          where: {
            and: [
              { key: { equals: PREFERENCE_KEYS.NAV } },
              { 'user.relationTo': { equals: user.collection } },
              { 'user.value': { equals: user.id } },
            ],
          },
        })
        .then((res) => res.docs[0]?.value as NavPrefs | undefined)
        .catch(() => undefined)
    : undefined;

  const shown: SidebarSection[] = [...sections, ...[...extra].map(([label, items]) => ({ label, items }))]
    .filter((s) => s.items.length > 0)
    .map((s) => ({ ...s, isOpen: prefs?.groups?.[s.label]?.open }));

  return (
    <NavWrapper baseClass="nav">
      <nav className="nav__wrap cfc-nav">
        <SidebarNav sections={shown} />
        <div className="nav__controls">
          <Logout />
        </div>
      </nav>
      <div className="nav__header">
        <div className="nav__header-content">
          <NavHamburger baseClass="nav" />
        </div>
      </div>
    </NavWrapper>
  );
}
