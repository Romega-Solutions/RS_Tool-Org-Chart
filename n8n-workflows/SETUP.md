# n8n Setup: Org Chart MCP Tools (read-only)

This repo includes an import-ready n8n workflow:

```txt
n8n-workflows/orgchart-mcp-tools.json
```

It contains an MCP Server Trigger with two read-only tools:

- `list_people` — flat staff list with emails (`/api/people/headless?includeInactive=true`).
- `get_chart_data` — the rendered org chart tree and departments (`/api/chart-data`).

The org chart is a read-only view of the Employee Portal. People, departments and reporting lines are edited in the portal's User Management, so the earlier editing tools (`create_person`, `update_person`, `reassign_person`, `delete_person`, `list_departments`, `sync_google_sheet`, `read_audit_log`) and the daily Google Sheets review were removed. If the live n8n workflow still has them, re-import this file or delete those nodes; their org chart endpoints now return 404.

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
```

6. Activate the workflow after the test URL works.

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

- `GET /org-chart/api/chart-data` and `GET /org-chart/api/people/headless` return live data from the Employee Portal (with `X-API-Key`).
- Production MCP URL initializes and lists the read-only tools.
- `pnpm qa:weekly-live` verifies the public login page, chart data, staff list, and MCP initialize plus `tools/list`.
