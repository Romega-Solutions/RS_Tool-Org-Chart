# Handoff: Switch the Org Chart to read from the Portal

Portal side finished 2026-10-08 (RS-Tool-Ticketing-System, branch `user-management-update`).
This file is for the Claude Code session in `../RS_Tool-Org-Chart`. Delete it once the switch is done.

## Decisions (final — don't re-litigate)

1. **The portal is the single source of truth** for people, departments, reporting lines and photos.
   All editing happens in the portal's User Management. The Org Chart becomes a **read-only view**.
2. The Org Chart reads the portal's Supabase Postgres **directly**, through read-only views
   (no API, no sync, no copy).
3. **No backfill.** The org chart's SQLite data is not migrated; the admin maps everyone by hand in the portal.
4. Employment type is dropped (it was empty for every person).
5. Nothing in the portal is named "org chart" — the shared surface is the neutral `directory` schema.

## What the portal provides

Schema `directory` (views only; created by `docs/migrations/add-directory-reader.sql` in the portal repo):

### `directory.people`
| column | type | notes |
|---|---|---|
| `id` | integer | portal user id (stable key) |
| `name` | text | |
| `email` | text | |
| `job_title` | text, nullable | shown as the box subtitle |
| `department` | text, nullable | one of the 6 below, or null |
| `is_active` | boolean | **filter out `false`** |
| `end_date` | text `YYYY-MM-DD`, nullable | |
| `reports_to_user_id` | integer, nullable | primary lead. Already defaults to the founder (Robbie Galoso) when unset; **null only for the founder = the root** |
| `photo_path` | text, nullable | object key in the public `user-photos` bucket; null = show initials |
| `display_order` | integer | sibling order under the same lead (default 0 — fall back to name) |
| `is_hidden` | boolean | **filter out `true`** (service/test accounts) |

### `directory.secondary_leads`
`user_id`, `also_reports_to_user_id` — "also reports to" (dotted/secondary connectors). Many per person.

### `directory.departments`
`name`, `color` (hex, nullable — fall back to a neutral colour), `display_order`.
Final departments: **Technical, HR, Sales, Marketing, Market Intelligence, Management.**

### Photos
Public bucket, no auth: `<SUPABASE_URL>/storage/v1/object/public/user-photos/<photo_path>`

### Connection
- Login role: `directory_reader` — can `SELECT` the three views above and nothing else
  (no `public`, `auth` or `storage` access).
- Supabase pooler, transaction mode (port 6543), username `directory_reader.<project-ref>`,
  `prepare: false` with postgres-js.
- Staging project ref: `aahnxrjpwbdiduqiqmsp`. The password is set by the admin when running the
  migration — get it from them; never commit it.

## Building the chart

- Nodes = `people` where `is_active AND NOT is_hidden`.
- Edges = `reports_to_user_id` (solid). Root = the person with `reports_to_user_id IS NULL`.
- If a lead is inactive/hidden, attach their reports to the root so nobody disappears.
- Secondary edges = `secondary_leads` (only when both ends are visible).
- Siblings sorted by `display_order`, then `name`.
- Box: photo or initials, name, `job_title`; left-border colour = department colour.

## Work in the Org Chart repo

1. Add a read-only Postgres connection (Drizzle + postgres-js) using the details above.
2. Replace the SQLite reads (chart data, public chart data, embed, export) with queries on `directory.*`.
3. Remove editing: people/department CRUD, photo upload/gallery, CSV import, bulk reassign,
   and the **Google Sheets sync + its cron** (it would otherwise keep a second source of truth).
4. Keep: the chart views, search, public read-only link / embed, exports (Excel/PNG/print).
5. `/api/people` can be retired — the portal no longer calls it.
6. Decide what happens to the chart's own login, audit log and n8n MCP tools once editing is gone.

## Rules

- Don't change anything in the portal repo from the Org Chart session.
- Confirm with the user before touching staging/prod databases or deploying.
- Don't commit/push unless asked.
