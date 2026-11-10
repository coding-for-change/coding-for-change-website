import type { Config } from 'payload';

/**
 * The admin sidebar: its sections, in order, and what sits in each – the
 * collections and globals by slug, and our own admin views by path
 * (components/nav/ draws it).
 *
 * It is also where every collection and global gets its `admin.group`:
 * `adminNavPlugin` below writes the section's name onto each of them and
 * sorts them in this order, so the dashboard's cards come in the same
 * groups and order as the sidebar. Grouping is admin-only – no table or
 * column depends on it, so moving an entry needs no migration.
 *
 * A collection or global left out here still shows, in a section of its own
 * `admin.group` after these.
 */

/** Icons from lucide-react, mapped in components/nav/icons.ts. */
export type NavIconName =
  | 'Activity'
  | 'Building2'
  | 'CalendarDays'
  | 'CircleHelp'
  | 'ClipboardCheck'
  | 'FileText'
  | 'FolderKanban'
  | 'Handshake'
  | 'HeartHandshake'
  | 'Hourglass'
  | 'House'
  | 'Image'
  | 'Inbox'
  | 'Info'
  | 'KeyRound'
  | 'Layers'
  | 'LayoutDashboard'
  | 'Link2'
  | 'Mail'
  | 'MapPinned'
  | 'MousePointerClick'
  | 'Network'
  | 'Newspaper'
  | 'Paperclip'
  | 'Scale'
  | 'Settings'
  | 'ShieldCheck'
  | 'Ticket'
  | 'UserCog'
  | 'UserPlus'
  | 'Users';

export type NavItem =
  | { collection: string; icon: NavIconName }
  | { global: string; icon: NavIconName }
  /**
   * One of our own admin views (payload.config.ts → admin.components.views).
   * `role` is the least role that sees it, the same the view itself checks
   * (access/roles.ts); collections and globals follow their own access.
   */
  | { view: `/${string}`; query?: Record<string, string>; label: string; icon: NavIconName; role: 'editor' | 'admin' };

export type NavSection = { label: string; items: NavItem[] };

export const ADMIN_NAV: NavSection[] = [
  {
    label: 'Applications',
    items: [
      { view: '/review', query: { form: 'application' }, label: 'Review applications', icon: 'ClipboardCheck', role: 'admin' },
      { collection: 'waitlist-signups', icon: 'Hourglass' },
      { view: '/mailing', label: 'Mailing', icon: 'Mail', role: 'admin' },
    ],
  },
  {
    label: 'Event Platform',
    items: [
      { global: 'tech-tour', icon: 'MapPinned' },
      { view: '/review', query: { form: 'techtour' }, label: 'TechTour registrations', icon: 'Ticket', role: 'admin' },
      { collection: 'share-links', icon: 'Link2' },
      { collection: 'share-access-log', icon: 'Activity' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { view: '/analytics', label: 'Dashboard', icon: 'LayoutDashboard', role: 'editor' },
      { collection: 'analytics-events', icon: 'MousePointerClick' },
      { collection: 'consent-records', icon: 'ShieldCheck' },
    ],
  },
  {
    label: 'Content',
    items: [
      { collection: 'projects', icon: 'FolderKanban' },
      { collection: 'team', icon: 'Users' },
      { collection: 'team-groups', icon: 'Network' },
      { collection: 'events', icon: 'CalendarDays' },
      { collection: 'blog-posts', icon: 'Newspaper' },
      { collection: 'faq', icon: 'CircleHelp' },
      { collection: 'sponsors', icon: 'Handshake' },
      { collection: 'sponsor-tiers', icon: 'Layers' },
      { collection: 'companies', icon: 'Building2' },
      { collection: 'media', icon: 'Image' },
    ],
  },
  {
    label: 'Pages',
    items: [
      { global: 'homepage', icon: 'House' },
      { global: 'about', icon: 'Info' },
      { global: 'partner', icon: 'HeartHandshake' },
      { global: 'membership', icon: 'UserPlus' },
      { global: 'legal', icon: 'Scale' },
    ],
  },
  {
    label: 'Forms',
    items: [
      { collection: 'forms', icon: 'FileText' },
      { collection: 'form-submissions', icon: 'Inbox' },
      { collection: 'applicant-files', icon: 'Paperclip' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { global: 'site-config', icon: 'Settings' },
      { collection: 'users', icon: 'UserCog' },
      { collection: 'payload-mcp-api-keys', icon: 'KeyRound' },
    ],
  },
];

/** Section and position of each collection (`c:slug`) and global (`g:slug`). */
const PLACES = new Map<string, { group: string; rank: number }>();
ADMIN_NAV.forEach((section, s) =>
  section.items.forEach((item, i) => {
    const key = 'collection' in item ? `c:${item.collection}` : 'global' in item ? `g:${item.global}` : null;
    if (key) PLACES.set(key, { group: section.label, rank: s * 1000 + i });
  }),
);

type Entity = { slug: string; admin?: object };

const placed = <T extends Entity>(entities: T[] | undefined, prefix: 'c' | 'g'): T[] =>
  (entities ?? [])
    .map((entity, index) => {
      const place = PLACES.get(`${prefix}:${entity.slug}`);
      const placedEntity = place ? ({ ...entity, admin: { ...entity.admin, group: place.group } } as T) : entity;
      return { entity: placedEntity, rank: place?.rank ?? Number.MAX_SAFE_INTEGER, index };
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ entity }) => entity);

/**
 * Groups and orders the collections and globals as in ADMIN_NAV. Listed last
 * in `plugins`, so it also reaches the ones the form builder and the MCP
 * plugin add.
 */
export const adminNavPlugin = (config: Config): Config => ({
  ...config,
  collections: placed(config.collections, 'c'),
  globals: placed(config.globals, 'g'),
});
