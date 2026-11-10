# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Coding For Change (codingforchange.com) website — a multi-service architecture with three main components orchestrated via Docker Compose.

## Architecture

The repo has three services under `outer/`, `inner/`, and `inner/cms/`:

- **Inner site** (`inner/`): A Next.js 15 App Router app (React 18, `output: 'standalone'`) with a normal page layout: every route lives under `src/app/(os)/`, whose layout wraps it in `SiteShell` (top nav and footer, a mobile layout on small screens). This is the **canonical site, served at `/`**. Server components read the CMS directly (`src/lib/cms.ts`, `CMS_INTERNAL_URL` in Docker); `src/middleware.ts` handles `?lang=` and the private pages (`src/lib/privatePages.ts`). Uses framer-motion and usehooks-ts.
- **Outer site** (`outer/`): A 3D Three.js scene (a retro computer on a desk) built with TypeScript and Webpack. It is the opt-in "enhanced experience" served at **`/3d`** (the inner site is rendered inside the 3D monitor screen via iframe). The Express server (`outer/server/index.ts`) is the single entry point on port 8080 and reverse-proxies to the inner site and CMS. The 3D scene is marked `noindex`, and mobile User-Agents requesting `/3d` are redirected to `/`.
- **CMS** (`inner/cms/`): Payload CMS v3 on Next.js 15, backed by PostgreSQL. Provides REST API at `/api/` and admin panel at `/admin/`. Collections: Events, FAQ, Media, Projects, Sponsors, Team. Globals: Membership, SiteConfig.

**Request flow** (all through outer Express, port 80→8080, see `outer/server/index.ts`):
- `/admin`, `/api`, `/_next`, `/media` → proxied to the CMS
- `/3d` → the 3D scene's static webpack build (served from `outer/public`)
- `/inner/*` → `301` redirect to `/*` (legacy path; inner is no longer embedded there)
- everything else (`/`, `/team`, `/join`, …) → proxied to the inner Next.js app, which renders the page

> Note: the 3D scene's webpack build sets `publicPath` to `/3d/`.

## Development Commands

### Outer site (3D scene)
```bash
cd outer
npm install
npm run dev      # webpack dev server
npm run build    # production build
npm start        # serve production build via Express
```

### Inner site (Next.js)
```bash
cd inner
npm install
npm run dev      # next dev (port 3000)
npm run build    # production build (standalone)
npm start        # serve the production build
```
There is no test suite in `inner/`; the Vitest tests live in `inner/cms`.

### CMS
```bash
cd inner/cms
pnpm install     # has pnpm-lock.yaml
pnpm dev         # Next.js dev server
pnpm build       # production build
pnpm generate:types  # generate Payload TypeScript types
pnpm test            # Vitest (pure logic: roles, Google sign-in checks, onboarding, DocuSeal)
```

### Full stack (Docker)
```bash
cp .env.example .env  # configure PAYLOAD_SECRET and DATABASE_URL
docker compose up --build                        # default stack
docker compose -f docker-compose.dev.yml up      # hot-reloading dev stack
docker compose -f docker-compose.prod.yml up     # production stack
```
Runs all services: outer (port 80), inner (also direct on 3001 in dev), CMS (port 3000), and PostgreSQL.

The **dev stack** (`docker-compose.dev.yml`) bind-mounts host source into each container and runs the dev servers (webpack `--watch` for outer, `next dev` for inner, `pnpm dev` for CMS) with polling-based file watching, so edits hot-reload. The 3D scene at `/3d` has no HMR and always requires a manual browser refresh after a rebuild.

## CMS schema changes — REQUIRED process

**Any change to a Payload collection, global, or field (anything that alters the DB schema) MUST ship with a committed migration.** Production runs `db.push: false` (only dev uses `push: true`), so prod's schema is updated *only* by migration files. Skipping this leaves prod querying tables/columns that don't exist → `relation "..." does not exist` 500s and "missing content / no Create button" in the admin. This is what caused the June 2026 outage.

Follow these steps exactly when updating the CMS:

1. **Make the code change** in `inner/cms/src/` (collection/global/`payload.config.ts`).
2. **Generate the migration against the last-deployed schema** — *not* against a dev DB that `push` has already mutated, or the diff comes out empty/wrong. Use a throwaway Postgres:
   ```bash
   cd inner/cms
   docker run -d --name cfc-pg-mig -e POSTGRES_USER=payload -e POSTGRES_PASSWORD=payload -e POSTGRES_DB=payload -p 55432:5432 postgres:16-alpine
   export DATABASE_URL=postgresql://payload:payload@localhost:55432/payload PAYLOAD_SECRET=$(head -c32 /dev/urandom | base64 | tr -dc a-zA-Z0-9 | head -c32)
   pnpm payload migrate            # apply existing committed migrations → baseline state
   pnpm payload migrate:create my_change_name   # diffs config vs baseline → writes src/migrations/<ts>_my_change_name.{ts,json}
   docker rm -f cfc-pg-mig
   ```
3. **Review** the generated `up`/`down` SQL. If it drops a column that holds data you must keep, hand-edit the migration to copy the data first (see `scripts/prod-localize-reconcile.sql` for the pattern).
4. **Verify the build:** `pnpm build` (this also runs the type-check that the prod Docker build gates on).
5. **Commit** the new `src/migrations/*` files **together with** the code change. Never commit one without the other.
6. **Deploy.** The CMS Dockerfile `CMD` is `pnpm payload migrate && pnpm start`, so pending migrations auto-apply on boot before the server starts. A migration failure blocks startup (loud crash-loop) rather than silently serving a broken schema — check `docker logs homepage-cms-1` if a deploy crash-loops.

Hard rules / gotchas:
- **Never enable `push` in production**, and never "fix" a schema drift by toggling it — `push` can drop columns non-interactively and destroy data.
- `inner/cms/package.json` **must keep `"type": "module"`** — `payload migrate` loads the TS config via tsx and without it the extensionless `./collections/*` imports fail with `ERR_MODULE_NOT_FOUND` (the boot crash fixed in `9dcc818`). `next build`/`next start` bundle the config so they hide this; only the migrate CLI exposes it.
- To repair a DB that already drifted (has the old schema, no matching migrations): restore a backup into a local Postgres, write a transactional reconcile script that creates the missing tables, copies data, drops old columns, and records the baseline migration as applied; diff the result against a fresh `pnpm payload migrate` (`pg_dump --schema-only`) to prove it matches, and boot the CMS against it before touching prod. `scripts/prod-localize-reconcile.sql` is the worked example.

## CMS roles and sign-in

`users.role` is `member` | `editor` | `admin` (helpers and the access sets in `inner/cms/src/access/roles.ts`):
- **member**: Google sign-in for the onboarding page only; `users.access.admin` keeps them out of the admin panel.
- **editor**: website content, page globals incl. `tech-tour`, `forms` (definitions, not submissions), analytics (not the signups CSV, which has addresses).
- **admin**: everything else: submissions, CVs, waitlist, consent records, share links, users, MCP API keys, `/admin/review`, `/admin/mailing`.

Rules when adding things:
- A new collection/global needs explicit access from `access/roles.ts`. Never `Boolean(user)`: members now have sessions on the public site, so "logged in" no longer means "staff".
- Custom endpoints use `requireAdmin` / `requireEditor` (`endpoints/util.ts`); custom admin views check the role themselves (root views skip Payload's gate) and get a `role` in `lib/adminNav.ts`.
- MCP keys act as their user (`call()` in `lib/mcpAdmin.ts`); a key whose user is not admin cannot use the admin tools. A raw `payload-mcp-api-keys` login has no role at all.
- Password login is refused for non-admins (`beforeLogin` in `collections/Users.ts`); everyone else uses Google (`endpoints/googleAuth.ts`, env `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_ALLOWED_DOMAIN`, `ADMIN_EMAILS`). The callback issues a native Payload session (`lib/payloadSession.ts`).

## Member onboarding

- Member data lives on the `users` row (`firstName`, `lastName`, `privateEmail`, `githubUsername`, `application`, `teamProfile`, `accountExportedAt`, `signedInAt`); `email` is the association address. There is no members collection; `team` stays the public profile and has `published` (non-editors only ever read published entries).
- `/admin/onboarding` (`components/onboarding/`, `endpoints/onboarding.ts`, admins only) creates accounts for applications at stage `admitted` and downloads, once, a ZIP with the Google Admin bulk-upload CSV and printable password sheets. **Google passwords must never be stored, logged or written to disk**: they live only inside that request. Re-export issues new ones. The CSV header is pinned to `lib/onboarding/fixtures/google-users-template.csv` by a test; replace the fixture with a fresh template from the Admin Console if Google changes it.
- Settings in the `onboarding` global (signed-in read only, admin write, not on MCP). Ticks and DocuSeal submissions are the plain tables `onboarding_checks` / `onboarding_documents` (`lib/onboarding/tables.ts`, `store.ts`); the global's `documents` array uses `dbName: 'onboarding_document_items'` because Payload would otherwise name its table `onboarding_documents` too.
- The member's own page is `/onboarding` on the public site (`inner/src/app/(os)/onboarding/`, `components/showcase/Onboarding.tsx`): the server component forwards only the `payload-token` cookie to `GET /api/onboarding/me` (`fetchOnboardingMe` in `inner/src/lib/cms.ts`, no-store) and is a private page (no Google tag, noindex, not in the sitemap). Member endpoints are in `endpoints/onboardingMember.ts` (`me`, `me/check`, `photo`): any signed-in account, never an id from the request, always the caller's own data.
- Forms with `requiresLogin` refuse anonymous submissions (`lib/onboarding/sync.ts`). The onboarding form's fixed-name answers (`displayName`, `bio`, `linkedin`, `githubUsername`, `photo`, `profilePublic`, rules in `lib/onboarding/memberForm.ts`) go to the account and, only with `profilePublic`, to an unpublished `team` entry (title placeholder "Member"/"Mitglied"). A resubmission updates that entry and unpublishes it; a resubmission without consent unpublishes it, takes the photo off and deletes the member's photos. Admins get a mail on every form and once when the member's own steps are done (`lib/onboarding/notify.ts`, `users.stepsCompletedAt`).
- Member photos go to `media` with `private: true` and `uploadedBy` (`POST /api/onboarding/photo`, 5 MB, checked from the bytes, at most 10 an hour, each upload replaces the member's unused earlier one). Only editors and the uploader can read a private media doc or its files; the Team hooks (`lib/onboarding/photo.ts`) make it public exactly while it is the image of a published profile. A form upload block has `accept: pdf | image`; image uploads only work on sign-in forms.
- The first account of an empty `users` table becomes admin (`firstAccountRole` in `access/roles.ts`), so `first-register` and `scripts/seed.mjs` work on a fresh install. Every later account keeps the role an admin gave it.
- **Documents (DocuSeal)**: every document in `onboarding.documents[]` (title, description, DocuSeal template id; templates with exactly one signer role) is signed through the association's self-hosted DocuSeal; there are no paper documents. Env `DOCUSEAL_URL` (public address), `DOCUSEAL_API_KEY`, `DOCUSEAL_WEBHOOK_SECRET`; without URL and key the page shows no documents and documents do not count towards "done". Code: `lib/onboarding/docuseal.ts` (pure: event → status, `mergeStatus`, external id, secret check, tested), `docusealClient.ts` (the three API calls, 10 s timeout), `documents.ts` (DB side), `endpoints/onboardingDocuments.ts`.
  - `POST /api/onboarding/documents/:item/start` (the caller's own account) creates a submission with `send_email: false` for the account's name and association address, `external_id` `cfc-onboarding:<user>:<item>`, and returns `<DOCUSEAL_URL>/s/<slug>`; the page opens it in a new tab (no iframe, no DocuSeal script on our pages). An open one (pending/opened) is returned again, a completed one is never restarted, declined/expired starts a new row. A per-(user, item) advisory lock prevents doubles; if DocuSeal fails nothing is stored, and a submission we could not store is archived again.
  - `POST /api/onboarding/docuseal-webhook` needs the header `X-Webhook-Secret` = `DOCUSEAL_WEBHOOK_SECRET` (constant-time; unset or under 24 chars refuses everything). The row is found **only** by DocuSeal's submission id (the external id is only cross-checked); unknown submissions are ignored with 200. Statuses only move up (pending < opened < declined/expired < completed), so duplicates and out-of-order events change nothing; completing calls `notifyIfStepsDone`.
  - Lost webhooks: `POST /api/onboarding/admin/documents/resync { user }` ("Refresh from DocuSeal" in the dashboard) and `POST /api/onboarding/documents/refresh` (the member's page when they come back to the tab, at most every 15 s) read `GET /submissions/{id}` and apply it the same way.
  - Consent: DocuSeal is a link to our own instance; nothing third-party loads on the site and no cookie or storage key is added, so `klaroConfig.ts` is unchanged. The signing pages are DocuSeal's own and need their own Datenschutz section (Legal global).
- Pure logic with Vitest tests in `lib/onboarding/` (`pnpm test`).

## Consent — REQUIRED process when adding anything third-party

The site runs a **self-hosted Klaro CMP** (`inner/src/lib/klaroConfig.ts`), not a hosted one. That means **there is no scanner watching for undeclared trackers** — the compliance obligation is manual and it is on whoever adds the code.

**Any change that loads a third-party script, embeds a third-party iframe, or writes a cookie / `localStorage` / `sessionStorage` key MUST be declared in the consent config before it ships.** Undeclared storage that fires before consent violates TDDDG § 25, and it is criterion 7 of the [Google EU User Consent Policy audit](https://support.google.com/google-ads/answer/16724512) — failing that audit can suspend conversion measurement, which in turn breaks the Ad Grants ≥1-conversion/month requirement and takes the grant down.

Steps:

1. **Add a service** to `services` in `inner/src/lib/klaroConfig.ts`, with its cookie patterns and a `purposes` entry.
2. **Write the DE + EN description.** Name the recipient explicitly (e.g. "Google Ireland Ltd. and Google LLC (USA)") and, if it touches advertising, say **"ads personalisation"** in words — audit criteria 2 and 4 are about the text, not the wiring.
3. **Gate the actual load** on consent. Either mark the script for Klaro to block, or check `consentFor(...)` from `inner/src/lib/consent.ts` before initialising. Don't assume Klaro blocks something it hasn't been told about.
4. **Bump `CONSENT_CONFIG_VERSION`** if the new tracker falls under a purpose visitors have already consented to — otherwise everyone who consented previously keeps a stale consent that never covered this. The version is stamped on every consent record, so it's also how an audit maps a consent to the banner text it was given against.
5. **Update the Datenschutz** (Legal global) — Art. 13 requires disclosure per recipient/purpose.
6. **Verify with an empty profile**: load the site, decline, and confirm in DevTools → Application that no cookie or storage key from the new service exists. Nothing fires before consent.

Hard rules / gotchas:
- **Never make "Reject all" less prominent than "Accept all".** `hideDeclineAll` stays `false`. This is the most-fined banner mistake under German DSK guidance and the styling note in `inner/src/consent.css` says so for a reason.
- **Google Consent Mode defaults live in `inner/src/components/general/GoogleTag.tsx`** and must execute *before* `gtag.js`. Reordering those two `<script>` tags silently reintroduces pre-consent cookies.
- Klaro clears cookies it declares, but **it cannot clear `localStorage`** — our persistent `visitorId` is wiped explicitly by `clearAttribution()` in `inner/src/lib/attribution.ts`, wired to consent withdrawal. Any new persistent storage needs the same treatment.
- Klaro is self-hosted and **upstream is quiet** (no npm release since v0.7.21, March 2024). Nothing updates automatically; a fix arrives only when someone bumps the package and deploys.

## Key Architectural Details

- The outer site uses a **singleton pattern** for the `Application` class (`outer/src/Application/Application.ts`) which manages the Three.js scene, camera, renderer, and world objects.
- The outer site's 3D world includes: Computer, MonitorScreen (renders the iframe), CoffeeSteam, Cursor, Decor, Environment, and Hitboxes.
- The inner site's UI component (`outer/src/Application/UI/`) is a React app rendered alongside the Three.js canvas for overlay controls.
- The inner site's routes are `inner/src/app/(os)/*/page.tsx` (the `(os)` group name is historical); they render the content components in `inner/src/components/showcase/` (Landing, Team, Projects, Join, TechTour, Onboarding, …). `inner/src/components/os/` (Window, Desktop, Toolbar, …) is left over from the old desktop-OS design and is not imported by any route.
- **Images**: every upload to the Media collection is capped at 2400px, re-encoded as WebP and given three renditions (thumbnail 400 / card 800 / large 1600 px wide) — see `inner/cms/src/collections/Media.ts`. The site requests a rendition with `mediaUrl(media, 'card')` (`inner/src/api/client.ts`) and falls back to the original. Images uploaded before the pipeline keep their files until `inner/cms/scripts/reprocess-media.mjs --apply` is run once against the CMS. HEIC uploads are rejected by design (sharp cannot decode them); export as JPEG/PNG first.
- The `INNER_SITE_URL` env var is baked into the 3D bundle at build time (webpack DefinePlugin) and controls the iframe URL the 3D monitor loads. It is set to `/` in Docker so the iframe loads the inner site through the outer Express proxy (same as production).

## Environment Variables

See `.env.example`:
- `PAYLOAD_SECRET` — required for CMS (min 32 chars)
- `DATABASE_URL` — PostgreSQL connection string
- `CMS_URL` / `INNER_URL` — set automatically in Docker Compose
- `GOOGLE_OAUTH_*`, `GOOGLE_ALLOWED_DOMAIN`, `ADMIN_EMAILS` — Google sign-in (see "CMS roles and sign-in")
- `DOCUSEAL_URL`, `DOCUSEAL_API_KEY`, `DOCUSEAL_WEBHOOK_SECRET` — onboarding documents (see "Member onboarding"); optional
