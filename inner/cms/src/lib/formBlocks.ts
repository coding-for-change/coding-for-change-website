import type { Block, Field } from 'payload';

/**
 * Custom field blocks for the form-builder plugin. The plugin ships text,
 * textarea, email, number, select, checkbox and message; these add the three
 * things our application forms need that it does not have:
 *
 * - `upload`        — a document (CV) stored privately in `applicant-files`
 * - `checkboxGroup` — a multi-select ("which events will you attend?")
 * - `subform`       — a checkbox that reveals another form's questions inline
 *                     ("also apply for membership") and submits them as a
 *                     separate submission of that form
 *
 * The inner site renders all of them in `components/forms/CmsForm.tsx`.
 * Adding a question to any form is done in the admin; no deploy needed.
 */

const name: Field = {
  name: 'name',
  type: 'text',
  label: 'Name (lowercase, no special characters)',
  required: true,
  admin: { width: '50%' },
};

const label: Field = {
  name: 'label',
  type: 'text',
  label: 'Label',
  localized: true,
  admin: { width: '50%' },
};

const width: Field = {
  name: 'width',
  type: 'number',
  label: 'Field Width (percentage)',
  admin: { width: '50%' },
};

const required: Field = {
  name: 'required',
  type: 'checkbox',
  label: 'Required',
  admin: { width: '50%' },
};

const description: Field = {
  name: 'description',
  type: 'text',
  label: 'Help text',
  localized: true,
  admin: { description: 'Shown under the field.' },
};

export const UploadBlock: Block = {
  slug: 'upload',
  labels: { singular: 'File upload (PDF)', plural: 'File uploads (PDF)' },
  fields: [
    { type: 'row', fields: [name, label] },
    { type: 'row', fields: [width, required] },
    {
      ...description,
      admin: { description: 'Shown under the field, e.g. "PDF, max. 5 MB".' },
    },
  ],
};

export const CheckboxGroupBlock: Block = {
  slug: 'checkboxGroup',
  labels: {
    singular: 'Checkbox group (multi-select)',
    plural: 'Checkbox groups (multi-select)',
  },
  fields: [
    { type: 'row', fields: [name, label] },
    {
      type: 'row',
      fields: [
        width,
        { ...required, label: 'Required (at least one must be ticked)' },
      ],
    },
    description,
    {
      name: 'options',
      type: 'array',
      labels: { singular: 'Option', plural: 'Options' },
      minRows: 1,
      admin: {
        description:
          'One checkbox per option. The submission records the labels of the ticked options, so keep labels descriptive (e.g. "Tue 10 Nov · Lio").',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'label',
              type: 'text',
              required: true,
              localized: true,
              admin: { width: '50%' },
            },
            {
              name: 'value',
              type: 'text',
              required: true,
              admin: {
                width: '50%',
                description: 'Stable key, e.g. "tue-lio". Not shown to visitors.',
              },
            },
          ],
        },
      ],
    },
  ],
};

export const SubformBlock: Block = {
  slug: 'subform',
  labels: {
    singular: 'Linked form (checkbox reveals it)',
    plural: 'Linked forms (checkbox reveals it)',
  },
  fields: [
    {
      type: 'row',
      fields: [name, { ...label, label: 'Checkbox label', required: true }],
    },
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'forms',
      required: true,
      label: 'Form to reveal',
      admin: {
        description:
          'When the box is ticked, this form\'s questions appear below it (fields with a name that already exists in this form, e.g. "email", are asked only once). On submit a separate submission of that form is created, so its answers land with the other submissions of that form.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
      admin: { description: 'Optional text under the checkbox.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'linkLabel',
          type: 'text',
          localized: true,
          admin: {
            width: '50%',
            description:
              'Optional link shown next to the checkbox, e.g. "What is the TechTour?". Opens in a new tab.',
          },
        },
        {
          name: 'linkUrl',
          type: 'text',
          admin: { width: '50%', description: 'e.g. /techtour' },
        },
      ],
    },
  ],
};

/**
 * Documents attached to a submission (ids from `applicant-files`). Set by the
 * inner site on submit; shows in the admin as clickable links to the files.
 */
export const submissionFilesField: Field = {
  name: 'files',
  type: 'relationship',
  relationTo: 'applicant-files',
  hasMany: true,
  admin: {
    description:
      'Documents uploaded with this submission (e.g. the CV). Click one to open or download it.',
  },
};
