import { describe, expect, it } from 'vitest';
import { buildSheetsHtml } from './sheets';

const people = [
  { firstName: 'Jürgen', lastName: 'Groß', email: 'juergen.gross@codingforchange.com', password: 'Kt7m-X9rp-4wQh' },
  { firstName: '<script>alert(1)</script>', lastName: 'O"Neil & Co', email: 'x@codingforchange.com', password: 'Ab2c-Def3-Gh4j' },
];

describe('buildSheetsHtml', () => {
  const html = buildSheetsHtml(people, 'https://codingforchange.com/onboarding');

  it('has one sheet per person, each ending in a page break', () => {
    expect(html.match(/<section class="sheet">/g)).toHaveLength(2);
    expect(html).toMatch(/\.sheet \{[^}]*break-after: page/);
    expect(html).toMatch(/page-break-after: always/);
  });

  it('shows name, address, password and the onboarding page', () => {
    expect(html).toContain('Jürgen Groß');
    expect(html).toContain('juergen.gross@codingforchange.com');
    expect(html).toContain('Kt7m-X9rp-4wQh');
    expect(html).toContain('https://codingforchange.com/onboarding');
  });

  it('escapes what comes from people', () => {
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('O&quot;Neil &amp; Co');
  });

  it('loads nothing from outside and has no em dash', () => {
    expect(html).not.toMatch(/<script|<link|src=|url\(/i);
    expect(html).not.toContain('—');
  });
});
