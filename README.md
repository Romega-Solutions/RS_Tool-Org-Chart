# RS Tool - Org Chart

Internal org chart and team directory tool for Romega Solutions.

The app manages people, departments, photos, audit history, chart views, exports, and role-based access for editors and viewers.

## Current Status

| Area | Status |
|---|---|
| Production URL | `https://tools.romega-solutions.com/org-chart` |
| Easypanel fallback URL | `https://romega-projects-rs-tool-org-chart.ikuuwb.easypanel.host/org-chart` |
| Deployment | GitHub Actions -> VPS/Easypanel |
| Latest verification | `aa26ea8` deployed through GitHub Actions; full live product QA passed on 2026-05-07 |
| Test suite | GitHub Actions lint, build, and Playwright Chromium suite passing |
| Production notes | Live passwords have been rotated. n8n/MCP setup is documented. API-key protected endpoints are live. |

Read the latest readiness note in [docs/production-readiness-2026-05-05.md](docs/production-readiness-2026-05-05.md).

## What It Does

- Interactive org chart with top-down, horizontal, and department-grid views.
- Admin CRUD for people and departments.
- People table with status filters, sorting, saved views, bulk actions, and CSV export.
- Photo management with upload, external Drive-photo import, WebP conversion, gallery assignment, missing-photo workflow, and delete cleanup.
- Export to styled Excel, PNG, print/PDF view, and CSV.
- Audit log for create, update, delete, toggle, and password-change activity.
- Editor/viewer role model with JWT session cookies.
- API-key support for external integrations such as n8n or automation scripts.
- n8n MCP workflow JSON for org chart tools plus daily Google Sheets review.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Default local accounts are seeded on first run:

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Editor |
| `editor` | `editor123` | Editor |
| `viewer` | `viewer123` | Viewer |

Change production passwords immediately after first login.

## Verification

Use the repo-local Playwright CLI with Chromium.

```bash
pnpm lint
pnpm build
npx playwright test --browser=chromium
```

Current expected E2E result:

```text
47 passed
0 skipped
```

The suite runs serially because it uses shared local SQLite data and upload storage.

## Production Checklist

Must finish before calling the rollout stable:

- [x] Refresh/rebuild the active Easypanel deployment so `/org-chart/account` and `/org-chart/api/auth/change-password` are available live.
- [x] Verify live `/org-chart/account` and `/org-chart/api/auth/change-password`.
- [x] Change production passwords for `admin`, `editor`, and `viewer`.
- [x] Confirm the seeded passwords fail:
  - `admin / admin123`
  - `editor / editor123`
  - `viewer / viewer123`
- [x] Confirm the new credentials work.
- [x] Configure and verify `tools.romega-solutions.com/org-chart`.
- [x] Deploy the `/org-chart/` redirect fix so the base URL no longer redirects to `/org-chart/org-chart/chart`.
- [x] Deploy the API-key protected-endpoint fix so n8n/MCP can use protected routes consistently.
- [x] Re-run live route/API smoke checks for `/org-chart/`, chart redirect, people API, and API-key protected departments API.
- [x] Re-run full live product smoke checks for login, chart render, Duane secondary connector, team placeholders, people CRUD, photos, crop/zoom, export, print, Sync Now, cleanup, and mobile layout after the latest data/photo update.

Data follow-up:

- [x] Import production team photos from the sheet into managed `/admin/photos` storage.
- [x] Confirm real team data and reporting lines through live chart QA.
- [x] Populate the new Google Sheet tab before running sync.
- [x] Configure Google Sheets sync so the live sheet can stay authoritative.

## CI/CD

Deployments are handled by `.github/workflows/deploy.yml`.

On push to `master`, the workflow:

1. Installs dependencies.
2. Runs lint.
3. Builds the app.
4. Installs Playwright Chromium.
5. Runs the full E2E suite.
6. Deploys to the VPS through SSH.
7. Verifies the live site title.

The deploy job only runs after CI passes.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | Production required | JWT signing key. Production startup fails without it. Use at least 32 random characters. |
| `NEXT_PUBLIC_BASE_PATH` | Production required | App base path. Production uses `/org-chart`. |
| `CRON_SECRET` | Optional | Bearer token for `/api/sync/cron`. |
| `SYNC_INTERVAL` | Optional | Auto-sync interval: `1h`, `6h`, `12h`, `24h`, or `off`. |
| `API_KEY` | Optional | External integration key. Grants editor access through `X-API-Key`. |

For n8n, set these on the n8n app, not the org chart app:

| Variable | Description |
|---|---|
| `ORGCHART_BASE_URL` | Org chart API base URL. Use the public domain or Easypanel fallback if the public domain times out from n8n. |
| `ORGCHART_API_KEY` | Same value as the org chart app `API_KEY`. Prefer n8n credentials if `$env` access is blocked. |
| `ORGCHART_SHEET_CSV_URL` | Published CSV export URL for the selected Google Sheet tab. |
| `ORGCHART_REVIEW_EMAIL` | Recipient for daily review summaries. |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` | Set to `false` only if trusted n8n workflows need `$env` access. Otherwise use n8n credentials. |

## API Summary

All endpoints require session auth unless noted. Write operations require editor access. External integrations can send `X-API-Key` when `API_KEY` is configured.

### People

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/people` | Any user | List people. Supports `?includeInactive=true`. |
| `GET` | `/api/people/:id` | Any user | Get one person. |
| `POST` | `/api/people` | Editor | Create person. |
| `PATCH` | `/api/people/:id` | Editor | Update person. |
| `DELETE` | `/api/people/:id` | Editor | Delete person. |
| `PATCH` | `/api/people/:id/toggle` | Editor | Toggle active/inactive. |
| `PATCH` | `/api/people/reassign` | Editor | Reassign reporting line. |

### Departments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/departments` | Any user | List departments. |
| `POST` | `/api/departments` | Editor | Create department. |
| `PATCH` | `/api/departments/:id` | Editor | Update department. |
| `DELETE` | `/api/departments/:id` | Editor | Delete department. |

### Chart, Photos, and Audit

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/chart-data` | Any user | Full org chart tree, departments, and settings. |
| `GET` | `/api/audit` | Any user | Audit log. Supports `?page=1&limit=50`. |
| `GET` | `/api/photos` | Any user | List uploaded photos and assignment status. |
| `POST` | `/api/photos/import-external` | Editor | Download external person photo URLs, convert to WebP, save to managed photo storage, and reassign people to the local uploaded files. |
| `POST` | `/api/photos/cleanup-unused` | Editor | Delete uploaded photo files that are not assigned to any person. |
| `DELETE` | `/api/photos/:filename` | Editor | Delete photo and clear linked person photo reference. |
| `POST` | `/api/upload` | Editor | Upload image. Max 5MB, WebP output, rate limited. |

### System

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/settings` | Any user | Get app settings. |
| `PATCH` | `/api/settings` | Editor | Update branding/settings. |
| `POST` | `/api/import` | Editor | CSV import. Max 10MB. |
| `POST` | `/api/sync` | Editor | Google Sheets sync. Reads optional `Status` / `Is Active` for active state, `Org Chart Team` / `Primary Team` for multi-team department overrides, and `Secondary Reports To` for dashed secondary chart connectors. |
| `GET` | `/api/sync/cron` | Bearer token | Scheduled sync trigger. |

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Login, rate limited. |
| `POST` | `/api/auth/logout` | Public | Logout. |
| `GET` | `/api/auth/me` | Public | Return current user or null. |
| `POST` | `/api/auth/change-password` | Any user | Change current user's password. |

## Security Notes

- API reads require authentication.
- Writes require editor role.
- CSRF protection uses Origin header validation for mutating requests.
- Login has brute-force protection.
- API keys use timing-safe comparison.
- Uploads enforce file type, size, disk quota, rate limit, and WebP conversion.
- File deletion protects against path traversal.
- Production requires `SESSION_SECRET`.
- Security headers and no-store API cache headers are applied.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui style components
- Drizzle ORM
- SQLite with `better-sqlite3`
- ExcelJS
- Sharp
- bcryptjs
- jose JWT sessions
- Playwright E2E

## Data and Storage

Runtime data is intentionally ignored by git:

- SQLite DB: `data/orgchart.db`
- Uploaded photos: `public/uploads/photos/`, served through `/uploads/photos/:filename` so runtime uploads and external photo imports work in standalone Docker deployments. Use Photos -> Clean Unused to remove duplicate files that are no longer assigned.

For QA, back up and restore those folders before running mutating product-flow tests against local data.

## Deployment Notes

The current app is deployed through GitHub Actions to the VPS/Easypanel app.

The Easypanel domain route for `tools.romega-solutions.com` should point to the app service over HTTP port `80`; Easypanel maps the running Next.js service to that port in production.

Older Docker Compose and hardening scripts remain in the repo for fresh-server setup or recovery, but the active production path is the GitHub Actions deploy workflow.

For a fresh self-hosted VPS:

```bash
git clone <repo-url> /opt/orgchart
cd /opt/orgchart
sudo ./scripts/harden-vps.sh
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --build
```
