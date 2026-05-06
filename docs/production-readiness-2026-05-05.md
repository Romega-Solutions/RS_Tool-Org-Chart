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

## Current Local Changes Awaiting Deploy

These are verified locally but not live until the next checkpoint commit/push/deploy:

- `/org-chart/` redirect fix. Current live behavior still redirects to `/org-chart/org-chart/chart`; local code fixes this by redirecting to `/chart` inside the Next base-path app.
- API-key protected endpoint fix. Local code accepts either `API_KEY` or `ORGCHART_API_KEY` and verifies the key before CSRF bypass. This makes protected routes like `/api/departments` work consistently for n8n/MCP.
- Expanded product-flow Playwright coverage for route redirects and API-key protected endpoint access.
- Combined n8n workflow: `n8n-workflows/orgchart-mcp-tools.json`.
- Docs refresh for README, TODO, and n8n setup.

## Verification Evidence

Local verification after the current fixes:

```txt
pnpm lint
pnpm build
NEXT_PUBLIC_BASE_PATH=/org-chart npx playwright test e2e/product-flow.spec.ts --browser=chromium
```

Expected local product-flow result:

```txt
3 passed
```

Live checks observed during setup:

```txt
https://tools.romega-solutions.com/org-chart/chart -> 200, redirects anonymous users to login
https://tools.romega-solutions.com/org-chart/api/people?includeInactive=true -> 200
https://tools.romega-solutions.com/org-chart/api/departments with X-API-Key -> 200 after the local API-key fix is deployed
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
No.,Name,Role/Position,Team,Reports To,Photo,Work Email
```

Do not run `sync_google_sheet` or Sync Now while the tab is empty.

## Remaining Work

1. Create checkpoint commit and push the current local fixes/docs.
2. Watch the GitHub deploy workflow until live verification completes.
3. Recheck:
   - `https://tools.romega-solutions.com/org-chart/`
   - `GET /org-chart/api/departments` with `X-API-Key`
   - n8n MCP `list_departments`
   - n8n MCP `read_audit_log`
4. Populate the new Google Sheet tab with headers and real team data.
5. Run the daily review flow.
6. Only run actual sync after the sheet data has been reviewed.
