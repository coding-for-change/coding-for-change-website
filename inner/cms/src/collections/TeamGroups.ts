import { CollectionConfig } from 'payload';
import { contentAccess } from '../access/roles';

/**
 * Teams (groups) shown as sections on the Team page — e.g. Engineering, Design,
 * Consulting. People are assigned to these under each person in the `team`
 * collection (`teamMemberships`). When any assignments exist, the Team page
 * groups people into a section per team (heading + optional logo), ordered by
 * `order`. With no teams/assignments the page falls back to one flat list.
 */
export const TeamGroups: CollectionConfig = {
  slug: 'team-groups',
  labels: { singular: 'Team', plural: 'Teams' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'order'],
    description:
      'Team sections for the Team page (e.g. Engineering, Design). Assign people to a team under each person in "Team Members".',
  },
  access: contentAccess,
  fields: [
    { name: 'name', type: 'text', required: true, localized: true },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Optional logo/image shown beside the team heading.' },
    },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 100,
      admin: { description: 'Lower shows first (e.g. 10, 20, 30 …).' },
    },
  ],
};
