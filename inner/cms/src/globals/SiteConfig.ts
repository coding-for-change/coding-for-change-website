import { GlobalConfig } from 'payload';

export const SiteConfig: GlobalConfig = {
  slug: 'site-config',
  label: 'Site Configuration',
  access: {
    read: () => true,
  },
  fields: [
    { name: 'clubName', type: 'text', required: true },
    { name: 'tagline', type: 'text', required: true, localized: true },
    { name: 'description', type: 'textarea', required: true, localized: true },
    { name: 'email', type: 'email', required: true },
    {
      name: 'socialLinks',
      type: 'array',
      fields: [
        { name: 'platform', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    { name: 'copyrightText', type: 'text', localized: true },
    { name: 'windowTitle', type: 'text', localized: true },
    {
      // Public Cal.com booking-page URL. Embedded as an iframe on the Contact
      // and home pages. Paste the Cal.com event link (cal.com/<user>/<event>).
      name: 'bookingUrl',
      type: 'text',
      label: 'Booking page URL (Cal.com)',
    },
    {
      // Group hero shown at the top of the /team page. Lives here because there
      // is no dedicated Team-page global; SiteConfig is already read app-wide
      // via useSiteConfig(), so the team page can pick it up without a new fetch.
      name: 'teamHeroImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Team page group photo',
      admin: {
        description:
          'Optional wide group photo shown at the top of the Team page. Left empty, the page starts straight at the member grid.',
      },
    },
    {
      // The club's headcount, shown above the Team page roster.
      //
      // Typed in rather than counted off the `team` collection on purpose:
      // only part of the club has a profile on the site, so a derived figure
      // under-reports it (the page held 12 profiles against 20 members). The
      // other two figures beside it — NGO partners and projects — are counted
      // from the Projects collection, which is complete.
      name: 'memberCount',
      type: 'text',
      label: 'Member count',
      admin: {
        description:
          'Shown above the team photos, e.g. "20" or "20+". How many people are in the club — not how many have a profile on the site. Leave empty to hide it.',
      },
    },
    {
      // Impact figures shown on the About page. Editable here so the numbers
      // can be bumped without a code deploy. The label is localized; the value
      // (e.g. "10+") is locale-agnostic.
      name: 'stats',
      type: 'array',
      label: 'About-page stats',
      fields: [
        { name: 'value', type: 'text', required: true },
        { name: 'label', type: 'text', required: true, localized: true },
      ],
    },
    {
      // Site-wide colour theme. "Auto" lets each visitor see light or dark based
      // on their own device setting; the forced options apply one theme to all.
      name: 'colorMode',
      type: 'select',
      label: 'Color mode',
      required: true,
      defaultValue: 'auto',
      options: [
        { label: "Auto — follow each visitor's device setting", value: 'auto' },
        { label: 'Always dark', value: 'dark' },
        { label: 'Always light', value: 'light' },
      ],
      admin: {
        description:
          'Controls the site colour theme. "Auto" shows each visitor light or dark based on their device/browser preference; the forced options apply one theme for everyone.',
      },
    },
    {
      // Which audience the homepage speaks to. The site has two front doors:
      // the regular partner-oriented page (NGOs book a first talk), and a
      // student-oriented page for the membership application round, which
      // borrows the Join page's look — round status, dated application
      // timeline, benefits and tracks — and sends every button straight to
      // the application form. Flipping this is the whole switch: the hero,
      // the section order, the nav button, the closing call-to-action and
      // the homepage <title> all follow it (inner/src/lib/homepageMode.ts).
      // The round's dates live in code: inner/src/lib/applicationPhase.ts.
      name: 'homepageMode',
      type: 'select',
      label: 'Homepage audience',
      required: true,
      defaultValue: 'partners',
      options: [
        { label: 'Partners — the professional, NGO-oriented homepage', value: 'partners' },
        { label: 'Students — application-phase homepage, styled like the Join page', value: 'students' },
      ],
      admin: {
        description:
          'Who the homepage is written for. Switch to "Students" while membership applications are open and back to "Partners" afterwards. Takes effect on the next page load — no deploy needed.',
      },
    },
  ],
};
