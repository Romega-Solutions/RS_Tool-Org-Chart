# n8n Setup: Org Chart MCP Tools and Google Sheets Review

This repo includes an import-ready n8n workflow:

```txt
n8n-workflows/orgchart-mcp-tools.json
```

It combines:

- MCP Server Trigger for AI/client access.
- MCP tools for org chart API actions.
- Daily Google Sheets review automation.
- Human-in-the-loop email summary for sheet changes.

The workflow does not auto-apply Google Sheet changes unless the `sync_google_sheet` MCP tool is called or the org chart app's Sync Now action is used.

For manual operations in the org chart app, use Settings -> `Preview Changes` first. It calls `/api/sync` with `dryRun: true`, computes the same review, and does not mutate people, departments, reporting, photos, `last_sync_at`, or `last_sync_summary`.

## Current Live URLs

Use the public app URL for browser and external clients:

```txt
https://tools.romega-solutions.com/org-chart
```

n8n runs inside Easypanel and should call the org chart app through the internal Docker service URL:

```txt
http://romega-projects_rs_tool-org-chart:80/org-chart
```

That internal URL only works from containers on the same Easypanel Docker network. It is not a browser URL.

Fallback public app URL:

```txt
https://romega-projects-rs-tool-org-chart.ikuuwb.easypanel.host/org-chart
```

## Required n8n Environment

Set these on the n8n Easypanel app:

```txt
GENERIC_TIMEZONE=Asia/Manila
TZ=Asia/Manila
WEBHOOK_URL=https://n8n-romega-n8n.ikuuwb.easypanel.host/
N8N_EDITOR_BASE_URL=https://n8n-romega-n8n.ikuuwb.easypanel.host/
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_PROTOCOL=https
ORGCHART_API_KEY=<org chart API key>
ORGCHART_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/161m2rlSDgZbstklDrlXZU87_0isWHJ2o3iLRVNUoW1A/export?format=csv&gid=947755283
ORGCHART_REVIEW_EMAIL=mark@romega-solutions.com
```

The import-ready workflow uses direct internal org chart URLs for HTTP/tool nodes, so `ORGCHART_BASE_URL` is not required for that workflow. Keep `ORGCHART_API_KEY` in n8n env because the tool nodes send it as `X-API-Key`.

If n8n nodes show `access to env vars denied`, either:

1. Prefer n8n credentials for secrets and direct URLs in nodes, or
2. Set this on the n8n app and restart n8n:

```txt
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

Only enable environment access when trusted users can edit workflows.

## Org Chart API Credential

Create an n8n credential:

```txt
Credential type: Header Auth
Credential name: Org Chart API Key
Header name: X-API-Key
Header value: <org chart API key>
```

In each org chart HTTP/tool node:

```txt
Authentication: Generic Credential Type
Generic Auth Type: Header Auth
Credential: Org Chart API Key
Send Headers: Off
```

Do not use both a Header Auth credential and a manual `X-API-Key` header in the same node.

## Import Workflow

1. Open n8n:

```txt
https://n8n-romega-n8n.ikuuwb.easypanel.host/
```

2. Import:

```txt
n8n-workflows/orgchart-mcp-tools.json
```

3. Open the MCP Server Trigger.

4. Confirm:

```txt
Path: rs-org-chart
Authentication: None
```

5. Ensure these MCP tool nodes are connected:

```txt
list_people
get_chart_data
list_departments
create_person
update_person
reassign_person
delete_person
sync_google_sheet
read_audit_log
```

6. Activate the workflow after the test URL works.

7. Open `Email Review Summary` and select the Gmail credential. The live workflow currently uses the existing `Gmail account` credential. If this is missing after import, the MCP tools can still work, but n8n may refuse to publish the scheduled review workflow.

## MCP URLs

Test URL:

```txt
https://n8n-romega-n8n.ikuuwb.easypanel.host/mcp-test/rs-org-chart
```

Production URL:

```txt
https://n8n-romega-n8n.ikuuwb.easypanel.host/mcp/rs-org-chart
```

The test URL only works while n8n is listening for a test event. The production URL only works after the workflow is active.

A browser GET is not a real MCP test. Use an MCP client to initialize/list tools/call tools.

Known live verification on 2026-05-07:

```txt
Production MCP initialize -> HTTP 200
tools/list -> 9 tools
list_departments -> returned live department JSON
read_audit_log -> returned live audit entries
```

## Google Sheet Setup

Use the new tab:

```txt
https://docs.google.com/spreadsheets/d/161m2rlSDgZbstklDrlXZU87_0isWHJ2o3iLRVNUoW1A/edit?gid=947755283#gid=947755283
```

CSV export URL:

```txt
https://docs.google.com/spreadsheets/d/161m2rlSDgZbstklDrlXZU87_0isWHJ2o3iLRVNUoW1A/export?format=csv&gid=947755283
```

Recommended headers:

```txt
No.,Name,Role/Position,Team,Reports To,Photo,Work Email,Status,Org Chart Team,Secondary Reports To
```

Required by the app sync:

```txt
Name
Role/Position
Team
```

Optional:

```txt
Reports To
Photo
Work Email
Status
Org Chart Team
```

`Photo` can contain a Google Drive share link, Google Drive open link, direct image URL, or uploaded filename. Sheet sync stores the external URL on the person first. To move those images into app-managed storage, open `/admin/photos` and run `Import External`; the app downloads the images, converts them to WebP, saves them under `/uploads/photos`, and updates each person to the managed local URL. Later syncs preserve an existing local `/uploads/photos/...` value when the sheet still points at an external URL, so you do not need to re-import every time.

Photo sync tracks the last sheet photo source after an external image is imported. If the sheet still points at the same source, sync keeps the managed WebP. If the sheet photo source changes later, sync replaces the managed WebP reference with the new external source so `/admin/photos` can import the new image.

`Status` is optional. Use `Active` for current people. Use `Resigned`, `Inactive`, `Offboarded`, or `Ended` to set `isActive=false` during sync. Blank status leaves the person's current active flag unchanged.

`Org Chart Team` is optional but recommended when `Team` contains multiple departments. The app can display one department per person, so sync prefers `Org Chart Team` / `Primary Team` over `Team`. Example: `Team = HR/Finance & Tech`, `Org Chart Team = Technical`. Sync also maps common department aliases such as `Tech` and `Technical` to the existing technical department instead of creating duplicate departments.

`Reports To` is optional. If the column is present, sync treats it as authoritative for reporting lines and clears the manager when the cell is blank. If the column is omitted entirely, existing reporting lines are left unchanged.

`Secondary Reports To` is optional. Use it when one person should keep one primary tree position but also show a dashed secondary connector to another manager or team placeholder, for example `Duane Vargas -> HR Team`. If the column is omitted entirely, existing secondary connectors are left unchanged. If the column is present with a blank cell, that person's secondary connectors are cleared.

Use Photos -> Clean Unused after a bulk re-import if duplicate unassigned files are left in managed storage.

Applied org chart syncs save a latest sync review in Settings. The review includes created/updated/error counts, status changes, department changes, reporting changes, photo source changes, protected managed photos, and warnings. Dry-run previews are not saved as the latest review.

Do not put MCP tool names, REST URLs, API actions, or API keys in the sheet. The sheet is only the employee data source.

The new tab exports successfully and is populated with the current team data. Do not run `sync_google_sheet` or Sync Now if the tab is ever cleared or being rebuilt.

## Troubleshooting

### `access to env vars denied`

Use direct node values and n8n credentials, or set:

```txt
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

Then restart n8n.

### `connect ETIMEDOUT 51.83.97.146:443`

n8n can reach the app from outside sometimes, but the n8n container may time out calling the same VPS public IP. Use the internal service URL in n8n:

```txt
http://romega-projects_rs_tool-org-chart:80/org-chart
```

That internal URL will not resolve in a browser.

### `webhook is not registered`

The production MCP URL only registers when the workflow is active.

### `Workflow could not be started`

Check the execution details. The most common causes are:

- A remaining `$env` expression in a sub-node while env access is blocked.
- Missing Header Auth credential.
- A tool node URL still pointing to a domain that times out from n8n.

## Verification Snapshot

Known verified behavior:

- `GET /org-chart/api/people?includeInactive=true` returns live people JSON.
- `read_audit_log` returns audit entries when configured with the Header Auth credential.
- Production MCP URL initializes, lists 9 tools, and successfully calls `list_departments` and `read_audit_log`.
- `gid=947755283` CSV export returns HTTP 200.
- `gid=947755283` is populated with current team data.
- `pnpm qa:weekly-live` verifies the public login page, people API, departments API, audit API, Google Sheet CSV, and MCP initialize plus `tools/list`.
