# CADRE Pipeline & Contacts

Internal CRM for CADRE sales at Eduworks: a 12-stage pipeline with stage gates and an 8-criteria
qualification scorecard (no P-win %), sitting on top of Google Workspace. The full spec is in
[`docs/SPEC.md`](docs/SPEC.md).

**Not for CUI or classified information.**

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1 Core | Data model, auth, orgs/contacts/opportunities, stage gates, scorecard, tiers, pipeline board, next actions | Done |
| 2 Import | Workbook importer with dry-run, Review queue | Not started |
| 3 Google sync | Gmail + Calendar sync, discovered contacts, stale-deal logic from synced activity | Not started |
| 4 Drive + Docs | Folder creation, file listing, template generation | Not started |
| 5 Post-sale | License records, renewal alerts, expansion opportunities | Not started (tables exist) |
| 6 Deploy | Dockerfile, Cloud Run + Cloud SQL, full README | Not started |

## Local setup

Requires Node 22.12 or newer (older versions fail with `ERR_REQUIRE_ESM` when the CSS is compiled) and
Postgres 16 (`docker compose up -d db` starts one).

```bash
cp .env.example .env          # then set AUTH_SECRET: openssl rand -base64 32
npm install
npm run db:deploy             # apply migrations
npm run db:seed               # stage/tier config + fictional demo data (dev only: wipes pipeline tables)
npm run dev                   # http://localhost:3000
```

With `DEV_LOGIN=1` (ignored in production) the login page offers a password-less dev sign-in for any
`@eduworks.com` address; `dev.admin@eduworks.com` is an admin in the seed data. Real sign-in is Google
SSO restricted to `ALLOWED_DOMAIN`; set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (OAuth setup is
documented in Phase 6). Emails listed in `ADMIN_EMAILS` become admins when they sign in.

For a real (non-demo) database run `npm run db:config` instead of `db:seed`: it loads only the stage
and tier config.

## Tests

```bash
npm test                      # Vitest: gates, scorecard, tiers, award window, forecast
npm run db:seed && npm run test:e2e   # Playwright against the seeded dev database
```

## How the pipeline rules work

- **Stages and gates** live in the `StageConfig` table, seeded from `config/stages.json`. Each gate is
  a checklist of rules (`fieldsFilled`, `minCount`, `activity`, `document`, `scorecardComplete`, …)
  evaluated by `src/domain/gates.ts`. Edit the JSON and run `npm run db:config -- --force`, or edit the
  rows directly; no code change needed. Unknown rule types fail closed.
- Moving forward several stages must pass every gate crossed. Admins can override with a comment.
  Moving backward always works but needs a reason. All of it lands in the opportunity's History tab.
- Leaving stage 9 (Contract) sets status to **Won**; the deal keeps moving through stages 10–12.
- **Confidence tier** and the **award-window lock** (Funding + Procurement path green) use thresholds
  from `config/tiers.json` (`Setting` row `pipeline`). A saved award window is kept but shown as
  "Untimed" whenever the lock doesn't hold.
- Fiscal quarters are US federal (Q1 starts 1 October). Money is USD.

## Layout

```
config/            stage gates and tier thresholds (seeded into the DB)
prisma/            schema, migrations, seed
src/domain/        pure rules: gates, scorecard, tier, award window, forecast (unit tested)
src/server/        database access, auth helpers, opportunity service, list queries
src/app/           pages, server actions, API routes (stage move, CSV export)
scripts/           clean_contacts.py (Insightly cleanup, input to the Phase 2 importer)
data/import/       triage workbook goes here; spreadsheets are gitignored (real contact data)
```
