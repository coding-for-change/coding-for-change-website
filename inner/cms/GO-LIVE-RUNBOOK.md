# Go-live runbook: applications WS 2026/27 + Munich TechTour

Everything that has to happen around merging PR #64, in order, with the exact
commands, the exact text to put into the CMS, and the Google Ads setup. Budget
about an hour, most of it in the CMS admin.

Who needs what:

| Step | Needs |
| --- | --- |
| 1, 2 | Google Ads account access + GitHub repo admin (to add a secret) |
| 3 | Merge rights on the repo |
| 4 | Whoever has SSH access to the VPS (only to *check*; nothing to run there) |
| 5, 7 | A laptop with the repo checked out and **Node 20 or newer** (`node --version`), plus a CMS admin login |
| 6 | A CMS admin login |

---

## 1. Google Ads: create the TechTour conversion action (before merging)

TechTour registrations report as their own conversion action, `techtour`, next
to the existing waitlist / application / contact / booking actions. The site
fires it only if it knows the action's **label**, which reaches production as a
GitHub secret (step 2). Do this first so the first deploy already carries it.

In Google Ads (the account that holds the Ad Grants campaigns):

1. **Goals → Conversions → Summary → "+ New conversion action".**
2. Choose **Website**. Enter `codingforchange.com`, let it scan, then pick
   **"Add a conversion action manually"** (we do not use the URL-based
   suggestions).
3. Fill in, exactly like the four existing actions (see
   `ADS-CONVERSION-TRACKING-PLAN.md`, §5):
   - Goal and action optimisation: **Submit lead form**
   - Conversion name: **TechTour registration**
   - Value: **Don't use a value**
   - Count: **One** (a person registering twice is still one registration)
   - Click-through conversion window: **30 days**
   - Attribution model: **Data-driven**
4. **Done → Save and continue.**
5. On the tag setup screen choose **"Install the tag yourself"** (or "See event
   snippet"). The event snippet contains a line like

   ```js
   'send_to': 'AW-123456789/AbCdEfGhIjKlMnOp'
   ```

   The part **after the slash** (`AbCdEfGhIjKlMnOp`) is the conversion label.
   Copy it. The part before the slash is the conversion ID we already use.
6. Back in **Goals → Conversions → Summary**, open the new action → **Edit
   settings** → make sure it is a **Primary action** ("Primary action used for
   bidding optimization"). Only Primary actions count in the Conversions column
   and towards the Ad Grants ≥ 1 conversion / month requirement.

Nothing else needs installing: the site already loads the Google tag with
Consent Mode, and `trackAdsConversion('techtour')` fires with `send_to` built
from the ID and this label.

## 2. GitHub: add the secret (before merging)

The deploy workflow **rewrites the production `.env` from GitHub secrets on
every deploy** (`.github/workflows/deploy.yml`), so a value typed into the
server's `.env` by hand is lost on the next deploy. The PR adds the line for
the new secret; the secret itself has to exist:

1. GitHub → repository **coding-for-change/coding-for-change-website → Settings
   → Secrets and variables → Actions → "New repository secret"**.
2. Name: `GOOGLE_ADS_LABEL_TECHTOUR` — Value: the label from step 1.5.
3. Save.

An unset label is **silent**: the site just never reports TechTour conversions
and nothing warns you. If you only add the secret after the deploy has run,
trigger a fresh deploy: GitHub → **Actions → Deploy → Run workflow**.

## 3. Merge

Merge PR #64 into `master`. That push starts the **Deploy** workflow
automatically (GitHub → Actions → Deploy). It:

1. runs the consent scan (fails the deploy if a tracker or storage key is not
   declared — the new `cfc-techtour-intro` key is declared),
2. builds the three Docker images and pushes them to the registry,
3. writes `/var/www/homepage/.env` from the secrets and copies the compose file
   to the VPS,
4. runs `docker compose pull && docker compose up -d` on the VPS.

The CMS container's start command is `pnpm payload migrate && pnpm start`, so
the two new migrations apply on boot **before** the server starts:

- `20260913_114726_techtour_forms_and_applicant_files` — new `applicant_files`
  table, the three new form-block tables, the `files` relation on submissions,
  the `tech_tour` global tables
- `20260913_131103_add_submission_review` — `review_status` and `review_notes`
  on submissions

Both are purely additive (no column is dropped or renamed).

## 4. Check the deploy (VPS)

Wait for the Deploy run to go green (~10 min). Then, from a machine with SSH
access to the VPS:

```bash
ssh deploy-homepage@codingforchange.com
cd /var/www/homepage
docker compose ps                       # all four services "Up"
docker compose logs --tail=120 cms      # look for the two "Migrated: 20260913_…" lines, then "Ready"
```

If the CMS is restarting in a loop, the migration failed; the log says why.
Do **not** work around it by enabling `push` — see the CMS section of
`CLAUDE.md`. A quick smoke test from anywhere:

```bash
curl -s https://codingforchange.com/api/globals/tech-tour | head -c 200   # JSON, not an error
curl -s -o /dev/null -w '%{http_code}\n' https://codingforchange.com/techtour  # 200
```

## 5. Set up the forms (laptop)

Production still has the old three-field `application` form and no `techtour`
form. One script fixes that. It talks to the live CMS over HTTPS with an admin
login and needs no dependencies (plain Node).

```bash
cd inner/cms                                   # in your checkout of the repo (master, after the merge)
export CMS_URL=https://codingforchange.com
export CMS_EMAIL='<your admin email>'
export CMS_PASSWORD='<your admin password>'

node scripts/upsert-forms.mjs                  # dry run — prints what exists, writes nothing
node scripts/upsert-forms.mjs --apply          # does the work
```

`--apply`:

- **creates** the `techtour` form (first name, last name, email, evenings
  multi-select, attendance commitment, privacy consent, "also apply for
  membership" box);
- **replaces the fields** of the existing `application` form with: first name,
  last name, email, motivation, **CV upload (PDF, required)**, 5 h/week
  commitment, privacy consent, "also register for the TechTour" box. Existing
  submissions are untouched (their answers stay under their old field names);
- writes the German labels for both;
- gives the **TechTour Page** global starting content **only if it is still
  empty**, and uploads the bundled Lio / McKinsey QuantumBlack / QuantCo logos
  to Media, attaching each to the matching evening.

Afterwards, verify in the admin (https://codingforchange.com/admin):

- **Forms → application** and **Forms → techtour** show the fields above;
  switch the locale selector (top right) to Deutsch and check the labels.
- Open https://codingforchange.com/join and https://codingforchange.com/techtour
  in a private window: both forms render, the "also …" box reveals the other
  form's questions.
- Do one real test on `/join`: upload a small PDF, tick "also register", pick
  an evening, submit. In **Forms → Form Submissions** you should see one
  `application` submission with the PDF under **Files** (click it — it opens
  only while you are logged in) and one `techtour` submission with your name
  copied over. Then delete both test submissions and, under **Forms →
  Applicant files**, the test PDF.

If something went wrong with the forms, editing the fields in the admin is
fine — or fix `scripts/lib/formDefinitions.mjs` and run `--apply` again. Forms
are matched by title, so renaming a form in the admin breaks the page lookup
(`/join` renders the form titled `application`, `/techtour` the one titled
`techtour`).

Alternative if you prefer not to send admin credentials from a laptop: the same
script is inside the CMS image. On the VPS:
`cd /var/www/homepage && CMS_URL=http://localhost:3000 CMS_EMAIL=… CMS_PASSWORD=… docker compose exec cms node scripts/upsert-forms.mjs --apply`

## 6. CMS content: TechTour page

**Admin → Globals → TechTour Page.** The script seeded English and German
starting copy; edit rather than retype. Do each field in **English**, then flip
the locale selector to **Deutsch** and do the localised fields again (the
date, status, logo and website fields are shared between languages).

| Field | What to enter |
| --- | --- |
| Kicker | `Munich TechTour · 9–13 November 2026` (DE: `Munich TechTour · 9.–13. November 2026`) — seeded |
| Title / Intro | Seeded. Adjust tone if you like; the intro animation shows its own headline. |
| Hero image | Optional. A group photo from a past company visit if you have one; otherwise leave empty. |
| Registration open | Ticked. Untick to close registration by hand. |
| Registration deadline | Seeded as **6 Nov 2026 23:59**. Change if you want to close earlier. |
| Company visits | Five rows, Mon–Fri. For **Monday** and **Friday**: replace `TBA` with the company name and set Status to *Confirmed* (or *Tentative*) once known. For every row: **Time** (e.g. `18:00–20:00`) and **Location** (street address or "Meet at U-Bahn …") as soon as the company confirms — while empty the page says "to be announced". Logo: upload via the field if the seeded one is missing. Website: the company's URL. |
| What participants get | Three seeded cards. Edit freely. |
| Commitment | The text under "One thing we ask" above the form — seeded. |
| Form heading / Closed message | Seeded. |

The registration form's list of evenings is **separate**: **Forms → techtour →
field "events" → Options**. When Monday's / Friday's company is known, change
the option labels there too (e.g. `Mon 9 Nov · Company to be announced` →
`Mon 9 Nov · <Company>`), in both languages. The `Value` column must not change.

## 7. CMS content: Datenschutz, TechTour form, deletion day

**Since October 2026 the steps for the TechTour are in
[`TECHTOUR-DATENSCHUTZ.md`](TECHTOUR-DATENSCHUTZ.md)** (German, with every
text in German and English): the Datenschutz (section 5 for the membership
application, a new section 5a for the TechTour), the consent box on the
techtour form, the deletion day, checks, and what to do with registrations
sent before the consent box existed. Do them before the TechTour page goes
public. (The former 7a–7c – the Datenschutz
texts to paste – are in that file now; 7d–7f keep their letters.)

In short, the Datenschutz edits are scripted and idempotent:

```bash
cd inner/cms                                   # same shell as step 5 (CMS_URL / CMS_EMAIL / CMS_PASSWORD set)
node scripts/upsert-content.mjs                # dry run: reports what would change
node scripts/upsert-content.mjs --apply        # writes English and German, reads back to verify
```

`--transfer=dpf` names the EU–US Data Privacy Framework instead of the
Standard Contractual Clauses for the email provider (Resend) in section 3 –
only relevant where section 3 does not name Resend yet; check Resend's DPA.

### 7d. Retention is automatic now

Set **TechTour Page → "Delete registrations on"** (31 Jan 2027 for 2026). On
that day the CMS deletes every TechTour registration sent before it, with its
CV, the hosts' decisions and the host share links (their activity log goes
with them). Membership applications are not touched by it: the Datenschutz
still promises deletion of unsuccessful ones six months after the round
(deadline 30 Oct 2026 → by **30 Apr 2027**) – put that date in the team
calendar and delete them under **Forms → Form Submissions**; a deleted
submission takes its CV with it.

### 7e. TechTour form

`node scripts/techtour-host-sharing.mjs` (dry run, then `--apply`) adds the
required consent box `hostSharing` – the registrant's consent to pass their
details and CV on to the partner companies of the evenings they picked, who
may then contact them to register – right before the privacy box, names the
evening options after the companies the TechTour page shows on those dates
(the option **values** never change), and replaces the original confirmation
message. Every other question stays as it is in the admin.

Do **not** re-run `upsert-forms.mjs --apply` for this: it replaces every
question with the starting definitions and would undo the edits made in the
admin since. When a company is announced, set it on the TechTour page and run
`techtour-host-sharing.mjs` again to carry the name into the form.

### 7f. Host share links: each company sees its evening's registrations

Once registrations come in (and at the latest a few days before each
evening): **Admin → Forms → Host share links → Create New**, one per evening.
In the review workspace (**Review applications → TechTour**), pick the evening
in the dropdown and click **Share with the host** to start with the evening
filled in.

- **Title** – what the host sees as the heading, e.g. `QuantCo – Wed 11 Nov`.
- **Evening** – everyone who registered for it **and ticked the `hostSharing`
  box** is on the host's list; registrations without that consent are left
  out (the review workspace says so).
- **Contacts at the company** – the addresses that may open the link. Each
  signs in with a six-digit code sent to that address, so a forwarded link
  alone opens nothing.
- **Expires** – leave empty: it becomes the Sunday of the event week, 23:59,
  the latest the Datenschutz allows.

Save, then **Write to the contacts** (sidebar) opens a prepared email with the
link in your own mail program. The host sees name, CV and the other answers
(never the email address), admits or declines each person, and can admit
everyone still open in one go. **Download CVs** gives it the CVs of everyone
the list shows (all, open, admitted or declined) as one ZIP, numbered as on
the page. If a company wants to contact the people it
admitted to register them, the consent allows sending it their addresses –
from the Excel export, for its evening only. Their decisions
show up right away in the review workspace (✓ / ✕ in the list, "Host
decisions" on each person) and in the Excel export – that is where to send the
confirmations from. Every sign-in, CV opened and decision is under **Host link
activity** (a ZIP counts as opening each CV in it). Tick **Blocked** to stop a link at once; deleting a link deletes
its activity.

## 7½. Keep the TechTour page out of search results until it is ready

**Admin → Globals → TechTour Page → Visibility** (in the sidebar):

| Setting | Nav + footer link, "also register" box on /join | Search engines | Sitemap |
| --- | --- | --- | --- |
| **Hidden** | no — the page is reachable by its URL only, and the join page does not mention the TechTour | `noindex` | not listed |
| **Unlisted** (default) | yes | `noindex` | not listed |
| **Public** | yes | indexed | listed |

Leave it on **Unlisted** (or **Hidden** if the nav link should wait too) while
Monday/Friday, times and locations are still open. Switch to **Public** once
the content is 100 % ready; no deploy needed. `noindex` tells Google to drop
the page on its next crawl. If it was already indexed, hurry it along in
Search Console → Removals → "Temporarily remove URL" for
`https://codingforchange.com/techtour`, and after going public request
indexing via the URL inspection tool.

## 8. Confirm the conversion action records

After the deploy with the secret in place, make one TechTour test
registration in a private window **and accept the cookie banner** ("Agree"),
since Google Ads conversions are only sent with marketing consent. Then:

- Google Ads → **Goals → Conversions → Summary**: the action's status moves
  from "Unverified" to "Recording conversions" within a day. Or use the Google
  Tag Assistant Chrome extension on `/techtour` and watch for a `conversion`
  event with the new label after submitting.
- CMS → **Analytics** (admin sidebar): the first-party funnel shows a
  `techtour` conversion immediately, consent or not.

Delete the test registration afterwards (step 5 shows where).

## 9. Announce

- Nav shows **TechTour 2026** (unless Visibility is Hidden); `/techtour` plays
  the opening animation on the first visit. Share
  `https://codingforchange.com/techtour` once Visibility is **Public**.
- `/join` is open until **30 Oct 2026, 23:59** and closes on its own; the
  TechTour form closes at the deadline set in step 6 or when you untick
  "Registration open".
- Reviewing: every submission has a status and notes in its sidebar; **Forms →
  Form Submissions → Download as Excel** gives one spreadsheet per form. See
  `APPLICATION-FORMS.md`.
