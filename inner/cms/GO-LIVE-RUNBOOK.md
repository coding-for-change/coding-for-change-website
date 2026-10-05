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

## 7. CMS content: Datenschutz

A script makes the edits below in both languages, structurally (it finds the
sections by heading, keeps the numbering, and is safe to re-run – an outdated
section 5 is replaced, a current one is left alone):

```bash
cd inner/cms                                   # same shell as step 5 (CMS_URL / CMS_EMAIL / CMS_PASSWORD set)
node scripts/upsert-content.mjs                # dry run: reports what would change
node scripts/upsert-content.mjs --apply        # writes English and German, reads back to verify
```

One wording choice is a decision for the association and is passed as an
option — read the draft below first:

- `--transfer=dpf` — the **email provider**: notification emails to the team
  (new application / registration / contact enquiry) and the waitlist emails
  go out through Resend (a US provider), which the current Datenschutz does
  not mention. The default names the EU Standard Contractual Clauses as the
  transfer basis; pass `--transfer=dpf` if Resend's data processing agreement
  shows a Data Privacy Framework certification instead.

Afterwards open https://codingforchange.com/privacy (EN and DE) and read
section 5, the storage list in section 8, the end of section 3 and the date in
the last section.

If you would rather paste by hand: **Admin → Globals → Legal → Privacy
Policy**, once in **English**, once with the locale switched to **Deutsch**.
The texts follow; the **[CHECK]** marker corresponds to the option above.

### 7a. Replace section 5 — "Application and registration forms"

Since October 2026 this section says that the **host company of each TechTour evening sees the
registrations for its evening and decides who attends** (step 7e changes the form to match).

**English** — replace the heading and the paragraphs of section 5 with:

> ## 5. Application and registration forms (membership, Munich TechTour)
>
> Via our forms you can apply to contribute to Coding for Change e.V. (page "Join") and register for our event series Munich TechTour (page "TechTour"). The two can be combined: if you tick the box for the other form inside one of them, its additional questions appear and we create two separate records – an application and a registration.
>
> For a **membership application** we process your first and last name, email address, where you study, your answers to our questions (for example about your motivation, your experience and where you would like to contribute), your CV (PDF) and your confirmations (for example of the expected time commitment). For a **TechTour registration** we process your first and last name, email address, the evenings you selected, your CV (PDF), any further details the form asks for (for example your university) and your confirmations (your commitment to attend, and that the host companies see your registration). In both cases we also store the time of submission, the language of the page, the wording of the boxes you ticked (as proof of what you confirmed) and – without any reference to you as a person – the channel through which you reached the page (for example a poster QR code), see section 7.
>
> Processing of an application is based on Art. 6(1)(b) GDPR (pre-contractual measures towards a participation relationship); processing of a TechTour registration is based on Art. 6(1)(b) GDPR (organising the event you asked to attend, including the host company's decision on who attends, see below). Insofar as you tick the consent box in the form, Art. 6(1)(a) GDPR is the additional legal basis; you can withdraw that consent at any time with effect for the future by emailing info@codingforchange.com.
>
> Your CV is uploaded to our server when you select the file and is never publicly accessible: within the association only logged-in members of our selection team, or of the team organising the TechTour, can open it, and for a TechTour registration also the host companies of the evenings you selected (see the next paragraph). A file you upload without then submitting the form is deleted automatically within 24 hours.
>
> **Host companies of the TechTour.** Every TechTour evening is hosted by a company, and that company decides who attends its evening. For this purpose we give the host company of each evening you selected access to your registration for that evening – your name, your CV and the other details you entered (for example your university), but not your email address – through a private link that only that company's contacts can open, that expires at the end of the event week at the latest and that we can block at any time; every access is logged. You confirm this in the form. The host company decides on your attendance and prepares the evening (for example access to its premises) under its own responsibility (Art. 4(7) GDPR); we ask the companies to use your data for nothing else and to delete any copies they downloaded after the event. We store the company's decision in order to let you know.
>
> During the selection process we keep an internal assessment for every application and registration (for example a score from 1 to 10, or "accepted", "unsure", "declined") together with notes. These serve solely to decide on your application or registration, are not passed on to the host companies, are deleted together with the other data, and are covered by your right of access (Art. 15 GDPR).
>
> The data is stored on our servers (section 3) and within the association is accessible only to the members entrusted with the selection or with organising the TechTour. Our team is notified of every new application and registration by email; that email contains your answers (not your CV) and is sent through the email service described in section 3.
>
> If your application is successful, your data is stored for the duration of your involvement in the association. If it is unsuccessful, we delete the application including the CV at the latest six months after the application round has closed, unless you have consented to longer storage for future opportunities. TechTour registrations, including the CV and the host company's decision, are deleted at the latest three months after the event week.

**Deutsch** — Abschnitt 5 (Überschrift und Absätze) ersetzen durch:

> ## 5. Bewerbungs- und Anmeldeformulare (Mitgliedschaft, Munich TechTour)
>
> Über unsere Formulare können Sie sich für eine Mitwirkung bei Coding for Change e.V. bewerben (Seite „Mitmachen“) und sich für unsere Veranstaltungsreihe Munich TechTour anmelden (Seite „TechTour“). Beides lässt sich kombinieren: Wenn Sie in einem der Formulare das Kästchen für das jeweils andere setzen, erscheinen dessen zusätzliche Fragen, und wir legen zwei getrennte Datensätze an – eine Bewerbung und eine Anmeldung.
>
> Bei einer **Mitgliedsbewerbung** verarbeiten wir Vor- und Nachname, E-Mail-Adresse, wo Sie studieren, Ihre Antworten auf unsere Fragen (z. B. zu Ihrer Motivation, Ihren Erfahrungen und dem Bereich, in dem Sie mitwirken möchten), Ihren Lebenslauf (PDF) sowie Ihre Bestätigungen (z. B. des zu erwartenden Zeitaufwands). Bei einer **TechTour-Anmeldung** verarbeiten wir Vor- und Nachname, E-Mail-Adresse, die von Ihnen gewählten Abende, Ihren Lebenslauf (PDF), weitere im Formular erfragte Angaben (z. B. Ihre Hochschule) sowie Ihre Bestätigungen (Ihre Teilnahmezusage und dass die gastgebenden Unternehmen Ihre Anmeldung sehen). In beiden Fällen speichern wir außerdem den Zeitpunkt der Übermittlung, die Sprache der Seite, den Wortlaut der Kästchen, die Sie gesetzt haben (als Nachweis dessen, was Sie bestätigt haben), und – ohne Bezug zu Ihrer Person – über welchen Kanal Sie auf die Seite gekommen sind (z. B. ein Plakat-QR-Code), siehe Ziffer 7.
>
> Die Verarbeitung einer Bewerbung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen zur Begründung eines Mitwirkungsverhältnisses); die Verarbeitung einer TechTour-Anmeldung auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Durchführung der Veranstaltung, an der Sie teilnehmen möchten, einschließlich der Entscheidung des gastgebenden Unternehmens, wer teilnimmt, siehe unten). Soweit Sie im Formular das Einwilligungskästchen setzen, ist zusätzlich Art. 6 Abs. 1 lit. a DSGVO Rechtsgrundlage; diese Einwilligung können Sie jederzeit mit Wirkung für die Zukunft per E-Mail an info@codingforchange.com widerrufen.
>
> Ihr Lebenslauf wird beim Auswählen der Datei auf unseren Server hochgeladen und ist zu keinem Zeitpunkt öffentlich abrufbar: Innerhalb des Vereins können ihn nur eingeloggte Mitglieder unseres Auswahlteams oder des TechTour-Organisationsteams öffnen, bei einer TechTour-Anmeldung außerdem die gastgebenden Unternehmen der von Ihnen gewählten Abende (siehe den nächsten Absatz). Eine Datei, die Sie hochladen, ohne das Formular anschließend abzuschicken, wird automatisch innerhalb von 24 Stunden gelöscht.
>
> **Gastgebende Unternehmen der TechTour.** Jeder TechTour-Abend wird von einem Unternehmen ausgerichtet, und dieses Unternehmen entscheidet, wer an seinem Abend teilnimmt. Zu diesem Zweck geben wir dem gastgebenden Unternehmen jedes von Ihnen gewählten Abends Zugriff auf Ihre Anmeldung zu diesem Abend – Ihren Namen, Ihren Lebenslauf und Ihre weiteren Angaben (z. B. Ihre Hochschule), nicht aber Ihre E-Mail-Adresse – über einen privaten Link, den nur die Ansprechpersonen dieses Unternehmens öffnen können, der spätestens mit Ende der Veranstaltungswoche abläuft und den wir jederzeit sperren können; jeder Zugriff wird protokolliert. Dies bestätigen Sie im Formular. Das gastgebende Unternehmen entscheidet in eigener Verantwortung (Art. 4 Nr. 7 DSGVO) über Ihre Teilnahme und bereitet den Abend vor (z. B. den Zutritt zu seinen Räumen); wir bitten die Unternehmen, Ihre Daten für nichts anderes zu nutzen und heruntergeladene Kopien nach der Veranstaltung zu löschen. Die Entscheidung des Unternehmens speichern wir, um Sie darüber zu informieren.
>
> Im Auswahlverfahren halten wir zu jeder Bewerbung und Anmeldung intern eine Bewertung (z. B. eine Punktzahl von 1 bis 10 oder „angenommen“, „unsicher“, „abgelehnt“) sowie Notizen fest. Diese dienen ausschließlich der Entscheidung über Ihre Bewerbung bzw. Anmeldung, werden nicht an die gastgebenden Unternehmen weitergegeben, werden zusammen mit den übrigen Daten gelöscht und sind von Ihrem Auskunftsrecht (Art. 15 DSGVO) umfasst.
>
> Die Daten werden auf unseren Servern (Ziffer 3) gespeichert und innerhalb des Vereins nur den mit der Auswahl bzw. der Organisation der TechTour betrauten Mitgliedern zugänglich gemacht. Über jede neue Bewerbung und Anmeldung wird unser Team per E-Mail benachrichtigt; diese E-Mail enthält Ihre Angaben (nicht den Lebenslauf) und wird über den in Ziffer 3 beschriebenen E-Mail-Dienst versendet.
>
> Im Falle einer Zusage werden Ihre Daten für die Dauer Ihrer Mitwirkung im Verein gespeichert. Im Falle einer Absage löschen wir die Bewerbung einschließlich Lebenslauf spätestens sechs Monate nach Ende der Bewerbungsrunde, sofern Sie nicht in eine längere Speicherung für künftige Gelegenheiten eingewilligt haben. TechTour-Anmeldungen löschen wir einschließlich Lebenslauf und der Entscheidung des gastgebenden Unternehmens spätestens drei Monate nach der Veranstaltungswoche.

In the last section, change the date to **October 2026** (DE: **Stand Oktober 2026**).

### 7b. Section 8 — add one bullet to the "Everything stored on your device" list

**English**, after the `cfc-locale` bullet:

> - cfc-techtour-intro – remembers that you have already watched the opening animation of the TechTour page, so it is not shown again (browser storage, not a cookie). Strictly necessary, until you clear your site data.

**Deutsch**, nach dem Punkt `cfc-locale`:

> - cfc-techtour-intro – merkt sich, dass Sie die Eröffnungsanimation der TechTour-Seite bereits gesehen haben, damit sie nicht erneut abgespielt wird (Browser-Speicher, kein Cookie). Unbedingt erforderlich, bis Sie Ihre Website-Daten löschen.

### 7c. Section 3 "Hosting" — add the email provider **[CHECK]**

Append as the last paragraph of section 3 (pick the transfer sentence that
matches Resend's DPA):

**English**

> **Email delivery.** Notifications to our team (new contact enquiries, applications, registrations) and emails to you (for example the waitlist notification) are sent through the email service Resend (Resend, Inc., San Francisco, USA), which processes sender and recipient addresses and the email content on our behalf under a data processing agreement (Art. 28 GDPR). Transfers to the USA are based on the EU Standard Contractual Clauses **[or: on the EU–US Data Privacy Framework, if Resend is certified]**. Legal basis: Art. 6(1)(f) GDPR (reliable delivery of the emails you or we have requested).

**Deutsch**

> **E-Mail-Versand.** Benachrichtigungen an unser Team (neue Kontaktanfragen, Bewerbungen, Anmeldungen) sowie E-Mails an Sie (z. B. die Wartelisten-Benachrichtigung) versenden wir über den E-Mail-Dienst Resend (Resend, Inc., San Francisco, USA), der Absender- und Empfängeradresse sowie den Inhalt der E-Mail in unserem Auftrag auf Grundlage eines Auftragsverarbeitungsvertrags (Art. 28 DSGVO) verarbeitet. Die Übermittlung in die USA erfolgt auf Grundlage der EU-Standardvertragsklauseln **[oder: des EU-US Data Privacy Framework, sofern Resend zertifiziert ist]**. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (zuverlässige Zustellung der von Ihnen oder uns veranlassten E-Mails).

### 7d. Make the retention real

The Datenschutz now promises deletion: applications six months after the round
(deadline 30 Oct 2026 → delete by **30 Apr 2027**), TechTour registrations
three months after the event week (13 Nov 2026 → delete by **13 Feb 2027**).
Put both dates in the team calendar. Deleting is manual: **Forms → Form
Submissions** (filter by form, select all, delete) and **Forms → Applicant
files** for the CVs. Accepted members' applications may be kept for the
duration of their involvement.

### 7e. TechTour form: the host companies decide who attends

Goes with 7a — run both in the same sitting, before the TechTour page goes
public. Same shell as step 5:

```bash
node scripts/techtour-host-sharing.mjs            # dry run: lists every change, writes nothing
node scripts/techtour-host-sharing.mjs --apply    # writes English and German, reads back to verify
```

It changes the live `techtour` form in three ways and leaves every other
question exactly as it is in the admin:

- adds the required box *"I agree that the host company of each evening I pick
  sees my registration and my CV (not my email address) and decides whether I
  can join that evening."* (DE: *„Ich bin einverstanden, dass das gastgebende
  Unternehmen …"*) right before the privacy box;
- names each evening option after the company the **TechTour page** shows on
  that date, in both languages. The page draws the rows and the form stores the
  option's label, so the two must agree; the option **values** never change;
- replaces the confirmation message, if it is still the original, with one that
  says the host companies decide and we email the result.

Do **not** re-run `upsert-forms.mjs --apply` for this: it replaces every
question with the starting definitions and would undo the edits made in the
admin since. When Monday's or Friday's company is announced, set it on the
TechTour page and run this script again to carry the name into the form.

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
