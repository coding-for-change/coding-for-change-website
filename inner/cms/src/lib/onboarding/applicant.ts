import { namePartsOf, type Submission } from '../../components/review/model';

/**
 * The person behind a membership application, as a new account needs them:
 * first and last name, and the private address they applied with. Read with
 * the review workspace's own rules (components/review/model.ts), so a form
 * with a single "name" question works too: its last word is the last name.
 */
export function applicantOf(s: Pick<Submission, 'submissionData'>): {
  firstName: string;
  lastName: string;
  privateEmail: string;
} {
  const parts = namePartsOf(s);
  let { firstName, lastName } = parts;
  if (!firstName && !lastName && parts.name) {
    const words = parts.name.split(/\s+/).filter(Boolean);
    lastName = words.length > 1 ? (words.pop() as string) : '';
    firstName = words.join(' ');
  }
  return { firstName, lastName, privateEmail: parts.email.toLowerCase() };
}
