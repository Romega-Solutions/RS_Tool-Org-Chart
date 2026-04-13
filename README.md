# RS-Auto-Org_Chart-Generator

Auto-generating organizational chart tool for Romega Solutions.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000

### Default Accounts

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Editor |
| editor | editor123 | Editor |
| viewer | viewer123 | Viewer |

## Docker

```bash
docker compose up -d
```

Data persists in Docker volumes (`orgchart_data`, `orgchart_uploads`).

## Tech Stack

Next.js 16, React 19, TypeScript 5, Tailwind 4, shadcn/ui, Drizzle ORM, SQLite, React Flow.

## Spec

See `docs/plan/RS-Auto-Org_Chart-Generator.md` in the PinayMate workspace.
