# Weekly Live QA

Run this once a week, and after any production auth, sync, photo, export, or routing change.

```bash
pnpm qa:weekly-live
```

The script reads `.env.local` automatically when present.

Required for protected checks:

```txt
API_KEY=<org chart API key>
```

Optional overrides:

```txt
ORGCHART_BASE_URL=https://tools.romega-solutions.com/org-chart
ORGCHART_API_KEY=<org chart API key>
ORGCHART_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/161m2rlSDgZbstklDrlXZU87_0isWHJ2o3iLRVNUoW1A/export?format=csv&gid=947755283
ORGCHART_MCP_URL=https://n8n-romega-n8n.ikuuwb.easypanel.host/mcp/rs-org-chart
```

## What It Checks

- Public login page returns the org chart app.
- People API returns live people data.
- Departments API works with `X-API-Key`.
- Audit API works with `X-API-Key`.
- Google Sheet CSV is reachable, populated, and has required columns.
- n8n production MCP endpoint responds to a JSON-RPC initialize probe.

The MCP probe reports `warn` rather than failing when the endpoint returns `404`, because that usually means the n8n workflow is inactive or the production MCP webhook is not registered. In that case, open n8n, activate the workflow, and retest the MCP Server Trigger production URL.

## Pass Criteria

- No `fail` rows in the script output.
- `warn` rows are acceptable only when they are known external setup states, such as inactive n8n MCP.
- Sheet row count is greater than zero.
- Protected API checks are not skipped.

## Follow-Up

If the MCP endpoint is active, use an MCP client to call:

```txt
list_departments
read_audit_log
```

Then run the n8n daily Google Sheets review workflow once from n8n and confirm it either sends the review email or reaches `No Sheet Changes`.
