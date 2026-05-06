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
- Activated the production n8n MCP workflow and verified read-only tools.
- Updated live n8n HTTP/tool nodes to call the org chart over the internal Easypanel service URL.
- Selected a new Google Sheet tab (`gid=947755283`) to avoid overwriting the old tab.
- Documented n8n env, Header Auth credential, MCP URLs, and troubleshooting.

## Latest Checkpoint Deploy

Checkpoint `aa26ea8 fix(auth): checkpoint base path redirects` has been pushed to `master` and deployed by GitHub Actions run `25443129282`.

The deploy included:

- `/org-chart/` redirect fix. Live base URL now redirects to `/org-chart/login?next=%2Fchart` instead of `/org-chart/org-chart/chart`.
- Login redirect fix. Successful live login now lands on `/org-chart/chart` instead of `/org-chart/org-chart/chart`.
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

GitHub Actions verification on run `25443129282`:

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

The n8n `read_audit_log` tool returned real audit entries after using the production MCP URL and internal Easypanel service URL.

## May 7 Live Product QA

Live QA was run against `https://tools.romega-solutions.com/org-chart` using disposable data.

Passed checks:

- Login lands on `/org-chart/chart` with no doubled `/org-chart/org-chart` path.
- Chart renders with Duane Vargas visible and the dashed secondary reporting connector present.
- Raw placeholder titles such as `TBA - ...` stay hidden in the chart.
- `/admin/team` hides org placeholder records such as `Tech/AI Team`, `HR Team`, `Market Intelligence Team`, `Marketing Team`, and `Sales Team`.
- `/admin/photos` hides the same placeholder records.
- Disposable people create/edit/delete works through the live API/session.
- Disposable photo upload returns a managed `/uploads/photos/...` asset and the asset is readable.
- Photo crop/zoom saves a new managed WebP photo and keeps it assigned to the person.
- Chart displays the disposable person after photo assignment.
- Excel export downloads successfully.
- Print/PDF route loads and includes Duane Vargas.
- Mobile chart renders with 28 nodes and no horizontal overflow at a 390px viewport.
- Sync Now uses the saved sheet URL and returns `created: 0`, `updated: 31`, `errors: 0`, `total: 31`.
- Settings now supports `Preview Changes`, which calls `/api/sync` with `dryRun: true` and shows the same review without writing people, departments, reporting, photos, `last_sync_at`, or `last_sync_summary`.
- Applied syncs store `last_sync_summary`, which is shown in Settings as `Latest Sync Review` with created/updated/error counts, status/team/reporting/photo changes, protected managed photos, and warnings.
- Cleanup unused photos returns no failures and no leftover disposable QA records were found.

Operational note: after the first connector check returned zero secondary edges, Sync Now was run and populated Duane Vargas with `secondaryReportsTo`. The rerun showed one secondary edge.

Weekly smoke is available with:

```txt
pnpm qa:weekly-live
```

The weekly script checks the public login page, people API, protected departments/audit APIs, the Google Sheet CSV, and n8n MCP endpoint registration status.

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
ORGCHART_API_KEY=<org chart API key>
ORGCHART_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/161m2rlSDgZbstklDrlXZU87_0isWHJ2o3iLRVNUoW1A/export?format=csv&gid=947755283
ORGCHART_REVIEW_EMAIL=mark@romega-solutions.com
```

The live n8n workflow uses this internal org chart service URL for HTTP/tool nodes:

```txt
http://romega-projects_rs_tool-org-chart:80/org-chart
```

That URL is only valid from n8n/Easypanel containers. Browser and external clients should use:

```txt
https://tools.romega-solutions.com/org-chart
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
No.,Name,Role/Position,Team,Reports To,Photo,Work Email,Status,Org Chart Team,Secondary Reports To
```

The `Photo` column can use Google Drive file links for review. After sheet sync applies those links, use `/admin/photos` -> `Import External` to download them into managed WebP storage so the photo gallery, chart, export, and print flows all use `/uploads/photos/...` URLs. Later syncs preserve existing managed WebP URLs when the sheet still references external images.

Photo sync records the last sheet photo source when an external image is imported. Same-source sheet syncs keep the managed WebP. Changed sheet photo sources replace the managed reference with the new source so the new image can be imported deliberately.

The optional `Status` column controls active visibility. `Active` keeps people active. `Resigned`, `Inactive`, `Offboarded`, and `Ended` set `isActive=false` on sync without deleting the person record or audit history.

The optional `Org Chart Team` column controls the single department shown by the app when the source `Team` has multiple departments. Sync prefers `Org Chart Team` over `Team` and maps common aliases such as `Tech` and `Technical` to the existing technical department.

The optional `Reports To` column is authoritative only when present. Blank cells clear the manager; omitted columns leave existing reporting lines unchanged.

The optional `Secondary Reports To` column creates dashed secondary connectors for matrix responsibilities without duplicating the person as a second node. Blank cells clear secondary connectors only when the column is present; omitted columns preserve existing secondary connectors.

Use Settings -> `Preview Changes` before applying a high-risk sheet update. The preview is non-mutating and does not change the saved latest sync review. Use Settings -> `Sync Now` only when the preview looks correct.

Use `/admin/photos` -> `Clean Unused` after duplicate imports to remove unassigned managed photo files.

Do not run `sync_google_sheet` or Sync Now while the tab is empty.

## Remaining Work

1. Run the daily Google Sheets review flow on schedule.
2. Re-run full live product smoke after any future sheet schema, auth, photo, export, or routing change.
3. Keep `n8n-workflows/orgchart-mcp-tools.json` aligned with live n8n before re-importing, especially internal service URLs and Gmail credential selection.
