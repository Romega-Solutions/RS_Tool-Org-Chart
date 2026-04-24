# RS-Auto-Org_Chart-Generator

Auto-generating organizational chart tool for Romega Solutions.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000

Default accounts are seeded on first run:

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Editor |
| editor | editor123 | Editor |
| viewer | viewer123 | Viewer |

Change passwords via the `users` table after first run.

## Docker

```bash
docker compose up -d
```

Data persists in Docker volumes (`orgchart_data`, `orgchart_uploads`).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Recommended | Secret key for JWT signing (min 32 chars). Defaults to a dev key if not set — **set this in production**. |
| `API_KEY` | Optional | API key for external integrations (n8n, AI agents). Enables `X-API-Key` header auth with editor-level access. |
| `CRON_SECRET` | Optional | Bearer token for `GET /api/sync/cron` endpoint. Required for scheduled Google Sheets sync. |

## API Reference

All endpoints accept JSON. Authenticate with either session cookies (browser) or `X-API-Key` header (external systems).

```bash
# Example: list all people
curl http://localhost:3000/api/people -H "X-API-Key: YOUR_KEY"
```

### People

| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| `GET` | `/api/people` | `?includeInactive=true` | Public |
| `GET` | `/api/people/:id` | — | Public |
| `POST` | `/api/people` | `{ name, title, departmentId, reportsTo?, photoUrl? }` | Editor |
| `PATCH` | `/api/people/:id` | `{ name?, title?, departmentId?, reportsTo?, isActive? }` | Editor |
| `DELETE` | `/api/people/:id` | — | Editor |
| `PATCH` | `/api/people/:id/toggle` | — | Editor |
| `PATCH` | `/api/people/reassign` | `{ personId, reportsTo }` | Editor |

### Departments

| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| `GET` | `/api/departments` | — | Public |
| `POST` | `/api/departments` | `{ name, color?, displayOrder? }` | Editor |
| `PATCH` | `/api/departments/:id` | `{ name?, color?, displayOrder? }` | Editor |
| `DELETE` | `/api/departments/:id` | — | Editor |

### Chart & Data

| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| `GET` | `/api/chart-data` | — | Public |
| `GET` | `/api/audit` | `?page=1&limit=50` | Public |
| `GET` | `/api/photos` | — | Public |
| `DELETE` | `/api/photos/:filename` | — | Editor |

### System

| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| `GET` | `/api/settings` | — | Public |
| `PATCH` | `/api/settings` | `{ "key": "value", ... }` | Editor |
| `POST` | `/api/import` | multipart `file` (CSV) | Editor |
| `POST` | `/api/sync` | `{ url? }` | Editor |
| `GET` | `/api/sync/cron` | — | Bearer `CRON_SECRET` |
| `POST` | `/api/upload` | multipart `file` (image) | Editor |

### Authentication

**Session (browser):** `POST /api/auth/login` with `{ username, password }` → sets `orgchart_token` cookie.

**API Key (external):** Set `API_KEY` in `.env.local`, then send `X-API-Key: <value>` header on every request. Grants editor-level access.

**Responses:** Mutations return the updated object. Unauthorized → `401`. Wrong role → `403`.

### Examples

```bash
# Create a person
curl -X POST http://localhost:3000/api/people \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","title":"Engineer","departmentId":3,"reportsTo":1}'

# Update a person
curl -X PATCH http://localhost:3000/api/people/1 \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Senior Engineer","isActive":true}'

# Reassign reporting line
curl -X PATCH http://localhost:3000/api/people/reassign \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"personId":10,"reportsTo":14}'

# Toggle active/inactive
curl -X PATCH http://localhost:3000/api/people/5/toggle \
  -H "X-API-Key: YOUR_KEY"

# Get full org chart tree
curl http://localhost:3000/api/chart-data

# Create department
curl -X POST http://localhost:3000/api/departments \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Engineering","color":"#3b82f6"}'

# Trigger Google Sheets sync
curl http://localhost:3000/api/sync/cron \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Tech Stack

Next.js 16, React 19, TypeScript 5, Tailwind 4, shadcn/ui, Drizzle ORM, SQLite, React Flow, bcryptjs, jose.

## Features

- 3 chart views: top-down tree, horizontal tree, department grid
- Full CRUD admin: people, departments, CSV import, branding settings
- Interactive dashboard with clickable stat cards linking to filtered team views
- Google Sheets sync: configure a published sheet URL in Settings → "Sync Now" in admin or `POST /api/sync`
- Audit log: every create/update/delete/toggle tracked at `/admin/audit`
- Photo management: upload, assign, delete profile photos at `/admin/photos`
- Role-based auth: editor (full access) vs. viewer (read-only chart)
- JWT sessions via HTTP-only cookies (bcrypt passwords stored in DB)
- Export: Excel, PDF, chart-to-image, print (theme-aware)
- Dark/light mode, keyboard navigation, undo/redo
- shadcn/ui tooltips throughout admin interface

## Spec

See `docs/plan/RS-Auto-Org_Chart-Generator.md` in the PinayMate workspace.
