import { CollectionConfig } from 'payload';
import { contentAccess } from '../access/roles';

export const Team: CollectionConfig = {
  slug: 'team',
  // Not "Teams", Payload's default for the slug – that is the team sections (TeamGroups).
  labels: { singular: 'Team Member', plural: 'Team Members' },
  // Enables drag-and-drop reordering in the admin list view. Payload stores the
  // position in a hidden `_order` field; the Team page sorts by it (sort=_order)
  // instead of the default newest-first. Reorder rows in admin → site updates.
  orderable: true,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'role', 'category'],
  },
  access: contentAccess,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'role', type: 'text', required: true, localized: true },
    {
      // Team assignments. When any member has memberships, the Team page groups
      // people into a section per team (heading + optional logo) instead of one
      // flat list; a person appears once under each team they're in. Leave a
      // row's role blank to reuse the main `role` above for that team.
      name: 'teamMemberships',
      label: 'Team memberships',
      type: 'array',
      admin: {
        description:
          'Assign this person to one or more teams, with the role they hold in each. Leave a role blank to reuse the main role above.',
      },
      fields: [
        { name: 'team', type: 'relationship', relationTo: 'team-groups', required: true },
        {
          name: 'role',
          type: 'text',
          localized: true,
          admin: { description: 'Optional — role in this team; falls back to the main role above.' },
        },
      ],
    },
    {
      // Splits the Team page into the core team and a separate "Advisers"
      // section. Defaults to a regular member.
      name: 'category',
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: [
        { label: 'Team member', value: 'member' },
        { label: 'Adviser', value: 'adviser' },
      ],
    },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'bio', type: 'textarea', required: true, localized: true },
    {
      name: 'links',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      // Companies this person has worked at. Their logos are revealed on the
      // Team page when hovering the person's card.
      name: 'companies',
      type: 'relationship',
      relationTo: 'companies',
      hasMany: true,
    },
  ],
};
