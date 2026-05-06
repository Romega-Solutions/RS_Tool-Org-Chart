# Production Readiness Update — 2026-05-05

## Current Status

The org chart app is live on the custom tools domain:

```txt
https://tools.romega-solutions.com/org-chart
```

Fallback Easypanel URL:

```txt
https://romega-projects-rs-tool-org-chart.ikuuwb.easypanel.host/org-chart
```

Production deploys through GitHub Actions to the VPS/Easypanel app. The deploy workflow requires `EASYPANEL_DEPLOY_WEBHOOK` in the GitHub `VPS_HOST` environment so Easypanel rebuilds/redeploys after source sync.

## Completed Since Initial Readiness Pass

- Added `/org-chart` base-path support.
- Configured `tools.romega-solutions.com` DNS to `51.83.97.146`.
- Added the custom Easypanel domain route over HTTP port `80`.
- Verified the custom domain serves the org chart app.
- Rebuilt/redeployed Easypanel so account-management routes are live.
- Rotated live passwords for `admin`, `editor`, and `viewer`.
- Verified old default passwords fail.
- Configured `API_KEY` for headless org chart API access.
- Added `API_KEY` to the GitHub `VPS_HOST` environment for future workflow use.
- Created combined n8n MCP + Google Sheets review workflow JSON.
- Selected a new Google Sheet tab (`gid=947755283`) to avoid overwriting the old tab.
- Documented n8n env, Header Auth credential, MCP URLs, and troubleshooting.

## Latest Checkpoint Deploy

Checkpoint `297e416 feat(integrations): checkpoint org chart n8n mcp readiness` has been pushed to `master` and deployed by GitHub Actions run `25420023889`.

The deploy included:

- `/org-chart/` redirect fix. Live base URL now redirects to `/org-chart/login?next=%2Fchart` instead of `/org-chart/org-chart/chart`.
- API-key protected endpoint fix. Valid `X-API-Key` access works for protected routes such as `/api/departments`.
- Expanded product-flow Playwright coverage for route redirects and API-key protected endpoint access.
- Combined n8n workflow: `n8n-workflows/orgchart-mcp-tools.json`.
- README, TODO, and n8n setup docs refresh.

## Verification Evidence

Local verification before the checkpoint:

```txt
pnpm lint
pnpm build
NEXT_PUBLIC_BASE_PATH=/org-chart npx playwright test e2e/product-flow.spec.ts --browser=chromium
```

Expected local product-flow result:

```txt
3 passed
```

GitHub Actions verification on run `25420023889`:

```txt
lint -> passed
build -> passed
Playwright Chromium tests -> passed
Easypanel deployment -> passed
workflow live verification -> passed
```

Live checks after deploy:

```txt
tools.romega-solutions.com DNS -> 51.83.97.146
https://tools.romega-solutions.com/org-chart/ -> 200, redirects to /org-chart/login?next=%2Fchart
https://tools.romega-solutions.com/org-chart/chart -> 200, redirects anonymous users to /org-chart/login?next=%2Fchart
https://tools.romega-solutions.com/org-chart/api/people?includeInactive=true -> 200
https://tools.romega-solutions.com/org-chart/api/departments with X-API-Key -> 200
```

The n8n `read_audit_log` tool returned real audit entries after using a Header Auth credential.

## n8n and MCP

Workflow file:

```txt
n8n-workflows/orgchart-mcp-tools.json
```

MCP paths:

```txt
Test: https://n8n-romega-n8n.ikuuwb.easypanel.host/mcp-test/rs-org-chart
Prod: https://n8n-romega-n8n.ikuuwb.easypanel.host/mcp/rs-org-chart
```

Required n8n env:

```txt
ORGCHART_BASE_URL=https://tools.romega-solutions.com/org-chart
ORGCHART_API_KEY=<org chart API key>
ORGCHART_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/161m2rlSDgZbstklDrlXZU87_0isWHJ2o3iLRVNUoW1A/export?format=csv&gid=947755283
ORGCHART_REVIEW_EMAIL=mark@romega-solutions.com
```

If n8n blocks `$env`, either use direct URLs plus Header Auth credentials, or set:

```txt
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

Restart n8n after changing env.

## Google Sheets

Use the new tab:

```txt
https://docs.google.com/spreadsheets/d/161m2rlSDgZbstklDrlXZU87_0isWHJ2o3iLRVNUoW1A/edit?gid=947755283#gid=947755283
```

CSV export:

```txt
https://docs.google.com/spreadsheets/d/161m2rlSDgZbstklDrlXZU87_0isWHJ2o3iLRVNUoW1A/export?format=csv&gid=947755283
```

Recommended headers:

```txt
No.,Name,Role/Position,Team,Reports To,Photo,Work Email,Status,Org Chart Team
```

The `Photo` column can use Google Drive file links for review. After sheet sync applies those links, use `/admin/photos` -> `Import External` to download them into managed WebP storage so the photo gallery, chart, export, and print flows all use `/uploads/photos/...` URLs.

The optional `Status` column controls active visibility. `Active` keeps people active. `Resigned`, `Inactive`, `Offboarded`, and `Ended` set `isActive=false` on sync without deleting the person record or audit history.

The optional `Org Chart Team` column controls the single department shown by the app when the source `Team` has multiple departments. Sync prefers `Org Chart Team` over `Team`.

Do not run `sync_google_sheet` or Sync Now while the tab is empty.

## Remaining Work

1. Populate the new Google Sheet tab with headers and real team data.
2. Re-test n8n MCP `list_departments` and `read_audit_log` from the active production MCP URL.
3. Run the daily Google Sheets review flow.
4. Only run actual sync after the sheet data has been reviewed.
5. Re-run full live product smoke for chart search, export, print, photos, and mobile after data/photo updates.
