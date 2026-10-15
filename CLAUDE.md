# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Coding For Change (codingforchange.com) website — a multi-service architecture with three main components orchestrated via Docker Compose.

## Architecture

The repo has three services under `outer/`, `inner/`, and `inner/cms/`:

- **Inner site** (`inner/`): A React (CRA) app styled as a Windows 95-like desktop OS. This is the **canonical site, served at `/`**. Uses react-router-dom, framer-motion, and usehooks-ts.
- **Outer site** (`outer/`): A 3D Three.js scene (a retro computer on a desk) built with TypeScript and Webpack. It is the opt-in "enhanced experience" served at **`/3d`** (the inner desktop OS is rendered inside the 3D monitor screen via iframe). The Express server (`outer/server/index.ts`) is the single entry point on port 8080 and reverse-proxies to the inner site and CMS. The 3D scene is marked `noindex`, and mobile User-Agents requesting `/3d` are redirected to `/`.
- **CMS** (`inner/cms/`): Payload CMS v3 on Next.js 15, backed by PostgreSQL. Provides REST API at `/api/` and admin panel at `/admin/`. Collections: Events, FAQ, Media, Projects, Sponsors, Team. Globals: Membership, SiteConfig.

**Request flow** (all through outer Express, port 80→8080, see `outer/server/index.ts`):
- `/admin`, `/api`, `/_next`, `/media` → proxied to the CMS
- `/3d` → the 3D scene's static webpack build (served from `outer/public`)
- `/inner/*` → `301` redirect to `/*` (legacy path; inner is no longer embedded there)
- everything else (`/`, `/about`, `/team`, …) → proxied to the inner app, which serves the SPA

> Note: the 3D scene's webpack build sets `publicPath` to `/3d/`, and the inner app's `index.html` is what's served at `/` — its bundle is CRA's non-content-hashed `/static/js/bundle.js`.

## Development Commands

### Outer site (3D scene)
```bash
cd outer
npm install
npm run dev      # webpack dev server
npm run build    # production build
npm start        # serve production build via Express
```

### Inner site (React desktop)
```bash
cd inner
npm install
npm start        # CRA dev server (port 3000)
npm run build    # production build
npm test         # Jest tests
```

### CMS
```bash
cd inner/cms
pnpm install     # has pnpm-lock.yaml
pnpm dev         # Next.js dev server
pnpm build       # production build
pnpm generate:types  # generate Payload TypeScript types
```

### Full stack (Docker)
```bash
cp .env.example .env  # configure PAYLOAD_SECRET and DATABASE_URL
docker compose up --build                        # default stack
docker compose -f docker-compose.dev.yml up      # hot-reloading dev stack
docker compose -f docker-compose.prod.yml up     # production stack
```
Runs all services: outer (port 80), inner (also direct on 3001 in dev), CMS (port 3000), and PostgreSQL.

The **dev stack** (`docker-compose.dev.yml`) bind-mounts host source into each container and runs the dev servers (webpack `--watch` for outer, CRA `npm start` for inner, `pnpm dev` for CMS) with polling-based file watching, so edits hot-reload. Note: the inner CRA bundle (`/static/js/bundle.js`) is **not** content-hashed and is served without a `Cache-Control` header — if the browser shows a stale UI, hard-refresh (Cmd+Shift+R) or enable "Disable cache" in DevTools. The 3D scene at `/3d` has no HMR and always requires a manual browser refresh after a rebuild.

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
- The inner site mimics a desktop OS with Window, Desktop, Toolbar, and DesktopShortcut components under `inner/src/components/os/`.
- Content pages (Home, About, Team, Events, Projects, Sponsors, etc.) live in `inner/src/components/showcase/`.
- **Images**: every upload to the Media collection is capped at 2400px, re-encoded as WebP and given three renditions (thumbnail 400 / card 800 / large 1600 px wide) — see `inner/cms/src/collections/Media.ts`. The site requests a rendition with `mediaUrl(media, 'card')` (`inner/src/api/client.ts`) and falls back to the original. Images uploaded before the pipeline keep their files until `inner/cms/scripts/reprocess-media.mjs --apply` is run once against the CMS. HEIC uploads are rejected by design (sharp cannot decode them); export as JPEG/PNG first.
- The `INNER_SITE_URL` env var is baked into the 3D bundle at build time (webpack DefinePlugin) and controls the iframe URL the 3D monitor loads. It is set to `/` in Docker so the iframe loads the inner site through the outer Express proxy (same as production).

## Environment Variables

See `.env.example`:
- `PAYLOAD_SECRET` — required for CMS (min 32 chars)
- `DATABASE_URL` — PostgreSQL connection string
- `CMS_URL` / `INNER_URL` — set automatically in Docker Compose
