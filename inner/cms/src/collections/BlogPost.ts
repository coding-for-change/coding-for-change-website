import { CollectionConfig } from 'payload';
import { contentAccess } from '../access/roles';

export const BlogPost: CollectionConfig = {
  slug: 'blog-posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'publishedAt', 'author'],
  },
  access: contentAccess,
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    {
      name: 'publishedAt',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'excerpt', type: 'textarea', required: true },
    { name: 'featuredImage', type: 'upload', relationTo: 'media' },
    {
      name: 'tags',
      type: 'array',
      fields: [{ name: 'tag', type: 'text', required: true }],
    },
    { name: 'author', type: 'relationship', relationTo: 'team' },
    { name: 'project', type: 'relationship', relationTo: 'projects' },
    { name: 'content', type: 'richText', required: true },
  ],
};
