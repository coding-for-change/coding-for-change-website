# Application forms: membership + Munich TechTour

How the two application forms work, how to set them up on production, and what
still needs a human.

## What exists

Both forms live in the CMS **Forms** collection (form-builder plugin) and are
rendered by one component, `inner/src/components/forms/CmsForm.tsx`. Adding,
removing or reordering a question is done in the admin, no deploy needed.

| Form title    | Rendered on  | Conversion label | Fields (start state)                                                                                  |
| ------------- | ------------ | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `application` | `/join`      | `application`    | first name, last name, email, why, **CV (PDF upload)**, 5 h/week commitment, privacy consent, *also register for the TechTour* |
| `techtour`    | `/techtour`  | `techtour`       | first name, last name, email, **evenings (multi-select)**, attendance commitment, privacy consent, *also apply for membership* |

Besides the plugin's own field types (text, textarea, email, number, select,
checkbox, message) three custom blocks exist, defined in `src/lib/formBlocks.ts`:

- **File upload (PDF)**: the file goes to the private `applicant-files`
  collection the moment it is picked (anonymous create, admin-only read,
  PDF only, 5 MB max). On submit its id is attached to the submission's
  **Files** field, so the CV opens straight from the submission in the admin.
  Uploads that never reach a submission are deleted after 24 h (boot + daily),
  or by hand with `pnpm payload run scripts/purge-applicant-files.mts`.
- **Checkbox group (multi-select)**: one checkbox per option; "Required" means
  at least one. The submission stores the ticked *labels*, so keep labels
  descriptive ("Tue 10 Nov · Lio").
- **Linked form (checkbox reveals it)**: a checkbox that shows another form's
  questions inline. Fields whose `name` already exists in the outer form
  (`firstName`, `lastName`, `email`, `privacy`) are asked once and copied. On
  submit a **separate submission of the linked form** is created, so TechTour
  registrations made from `/join` sit with the other TechTour registrations,
  and membership applications made from `/techtour` sit with the other
  applications. Each fires its own conversion. The optional link next to the
  checkbox opens in a new tab.

Checkbox labels may contain `[text](url)` links, which is how the privacy
consent points at `/privacy`.

## Reviewing applications

Every submission has a **Review status** (Unreviewed / Accepted / Unsure /
Rejected) and **Notes on the applicant** in its sidebar in the admin; the
answers themselves are read-only there. The list view shows the status column.

**Download as Excel:** at the top of Forms → Form Submissions there is one
button per form (`application`, `techtour`, `Contact`). Each streams
`/api/submissions-export.xlsx?form=<title>` — one row per submission with the
answers in the form's order, links to the uploaded CV (open only while logged
in to the admin), the review status and notes, and the campaign attribution.
The status column has a dropdown for reviewing in the sheet; decisions made
there still have to be entered in the CMS, there is no import.

## Closing on their own

- The membership application form closes at the deadline in
  `inner/src/lib/applicationPhase.ts` (30 Oct 2026, 23:59 Berlin time) and the
  waitlist signup takes its place. The timeline's states move with the dates.
- The TechTour form closes when "Registration open" is unticked on the TechTour
  Page global or its registration deadline passes.
- The cross "also …" boxes disappear as soon as the other form has closed, so
  neither page can feed a closed round.

> **Going live?** The step-by-step order (Google Ads action → GitHub secret →
> merge → check the deploy → forms script → CMS content → Datenschutz text →
> verify conversions) with exact commands and paste-ready texts is in
> `GO-LIVE-RUNBOOK.md`.

## Setting the forms up on production

The prod CMS still has the old three-field `application` form and no `techtour`
form. After deploying (the migration `20260913_114726_techtour_forms_and_applicant_files`
runs on boot), run once from `inner/cms`:

```bash
CMS_URL=https://codingforchange.com CMS_EMAIL=<admin> CMS_PASSWORD=<pw> \
  node scripts/upsert-forms.mjs          # dry run: shows what exists
CMS_URL=https://codingforchange.com CMS_EMAIL=<admin> CMS_PASSWORD=<pw> \
  node scripts/upsert-forms.mjs --apply  # creates techtour, REPLACES application's fields
```

`--apply` replaces the fields of an existing form with the definitions in
`scripts/lib/formDefinitions.mjs` (existing submissions are untouched). It also
gives the **TechTour Page** global starting content, but only if it is still
empty, and uploads the company logos bundled in `scripts/assets/techtour/`
(Lio, McKinsey QuantumBlack, QuantCo), attaching each to the event whose
company name matches. From then on, edit in the admin.

`--logos` does only the logo step — useful after the page content was written
by hand in the admin. Events that already have a logo are left alone.

The dev seed (`pnpm seed`) creates the same forms and page content.

## Still needs a human

- **TechTour page content** (admin → Globals → TechTour Page): Monday's and
  Friday's company, time and location of every evening (empty = "to be
  announced" on the page), company logos, hero image, registration deadline.
- **Datenschutz** (admin → Globals → Legal): `node scripts/upsert-content.mjs
  --apply` adds the section on applications and event registrations, the
  storage-list bullet and the email provider in both languages (options and
  texts in `GO-LIVE-RUNBOOK.md` §7). Then actually delete submissions and
  files when the stated retention periods end.
- **Google Ads**: create a conversion action for TechTour registrations and set
  `GOOGLE_ADS_LABEL_TECHTOUR` in `.env` (already passed through compose).
- **Rate limiting**: `POST /api/applicant-files` is open to anonymous callers by
  design (PDF only, 5 MB). If abuse ever shows up, add a per-IP limit for that
  path in the outer Express proxy.
