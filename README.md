# RS Tool - Org Chart

Internal org chart and team directory tool for Romega Solutions.

The app manages people, departments, photos, audit history, chart views, exports, and role-based access for editors and viewers.

## Current Status

| Area | Status |
|---|---|
| Production URL | `https://romega-projects-rs-tool-org-chart.ikuuwb.easypanel.host` |
| Planned domain | `tools.romega-solutions.com/org-chart` |
| Deployment | GitHub Actions -> VPS/Easypanel |
| Latest verification | Local `/org-chart` lint, build, and Playwright QA passing |
| Test suite | Playwright Chromium: 47 passing tests, no skips |
| Production blocker | Live rebuild still needs the Easypanel deploy webhook, then password rotation |

Read the latest readiness note in [docs/production-readiness-2026-05-05.md](docs/production-readiness-2026-05-05.md).

## What It Does

- Interactive org chart with top-down, horizontal, and department-grid views.
- Admin CRUD for people and departments.
- People table with status filters, sorting, saved views, bulk actions, and CSV export.
- Photo management with upload, WebP conversion, gallery assignment, missing-photo workflow, and delete cleanup.
- Export to styled Excel, PNG, print/PDF view, and CSV.
- Audit log for create, update, delete, toggle, and password-change activity.
- Editor/viewer role model with JWT session cookies.
- API-key support for external integrations such as n8n or automation scripts.

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

- [ ] Refresh/rebuild the active Easypanel deployment so `/org-chart/account` and `/org-chart/api/auth/change-password` are available live.
- [ ] Verify live `/org-chart/account` and `/org-chart/api/auth/change-password`.
- [ ] Change production passwords for `admin`, `editor`, and `viewer`.
- [ ] Confirm the seeded passwords fail:
  - `admin / admin123`
  - `editor / editor123`
  - `viewer / viewer123`
- [ ] Confirm the new credentials work.
- [ ] Re-run live smoke checks for chart, search, export, print, photos, and mobile.
- [ ] Configure `tools.romega-solutions.com/org-chart`.
- [ ] Update live references after the custom domain is verified.

Data follow-up:

- [ ] Upload production team photos.
- [ ] Confirm real team data and reporting lines.
- [ ] Configure Google Sheets sync if the live sheet should stay authoritative.

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
| `CRON_SECRET` | Optional | Bearer token for `/api/sync/cron`. |
| `SYNC_INTERVAL` | Optional | Auto-sync interval: `1h`, `6h`, `12h`, `24h`, or `off`. |
| `API_KEY` | Optional | External integration key. Grants editor access through `X-API-Key`. |

## API Summary

All endpoints require session auth unless noted. Write operations require editor access.

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
| `DELETE` | `/api/photos/:filename` | Editor | Delete photo and clear linked person photo reference. |
| `POST` | `/api/upload` | Editor | Upload image. Max 5MB, WebP output, rate limited. |

### System

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/settings` | Any user | Get app settings. |
| `PATCH` | `/api/settings` | Editor | Update branding/settings. |
| `POST` | `/api/import` | Editor | CSV import. Max 10MB. |
| `POST` | `/api/sync` | Editor | Google Sheets sync. |
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
- Uploaded photos: `public/uploads/photos/`

For QA, back up and restore those folders before running mutating product-flow tests against local data.

## Deployment Notes

The current app is deployed through GitHub Actions to the VPS/Easypanel app.

Older Docker Compose and hardening scripts remain in the repo for fresh-server setup or recovery, but the active production path is the GitHub Actions deploy workflow.

For a fresh self-hosted VPS:

```bash
git clone <repo-url> /opt/orgchart
cd /opt/orgchart
sudo ./scripts/harden-vps.sh
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --build
```
