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

## Tech Stack

Next.js 16, React 19, TypeScript 5, Tailwind 4, shadcn/ui, Drizzle ORM, SQLite, React Flow, bcryptjs, jose.

## Features

- 4 chart views: top-down, horizontal, collapsible, department grid
- Full CRUD admin: people, departments, CSV import, branding settings
- Google Sheets sync: configure a published sheet URL in Settings → "Sync Now" in admin or `POST /api/sync`
- Audit log: every create/update/delete/toggle tracked at `/admin/audit`
- Role-based auth: editor (full access) vs. viewer (read-only chart)
- JWT sessions via HTTP-only cookies (bcrypt passwords stored in DB)
- Export: Excel, PDF, chart-to-image
- Dark/light mode, keyboard navigation, undo/redo

## Spec

See `docs/plan/RS-Auto-Org_Chart-Generator.md` in the PinayMate workspace.
