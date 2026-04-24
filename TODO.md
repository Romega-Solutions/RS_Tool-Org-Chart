# RS Auto Org Chart Generator — TODO

> Status: Feature-complete — all 3 improvement phases done + Phase 4 UX polish
> Last updated: 2026-04-24

---

## What's Done

### Core Features
- [x] 3 chart views (top-down, horizontal, department grid)
- [x] Full CRUD admin for people and departments
- [x] CSV import
- [x] Google Sheets sync (configure URL in Settings → "Sync Now")
- [x] Audit logging
- [x] Role-based auth (Editor/Viewer) with bcrypt + JWT
- [x] Export: Excel, PDF, chart-to-image (PNG)
- [x] Dark/light mode, keyboard navigation, undo/redo
- [x] Seeded default accounts (admin/editor/viewer)
- [x] Next.js 16 compatibility (middleware → proxy migration)

### Phase 1 — Bug Fixes ✅ (merged PR #1)
- [x] HorizontalTree ReactFlowProvider + SelectionMode fix
- [x] ImportDialog missing onImportComplete on team page
- [x] PersonForm error handling, dept validation, clear option
- [x] PeopleTable: window.confirm → ConfirmDialog
- [x] Bulk ops error handling, editor-only import button
- [x] useChartData error state + retry UI
- [x] Zoom/fit buttons disabled in grid view
- [x] Circular reference detection in drag-to-reassign + buildTree

### Phase 2 — Chart Visualization ✅
- [x] Grid view hierarchy indicators (reports-to, direct reports count)
- [x] Wider node cards (160px) + hover title tooltips
- [x] Density toggle for grid view (compact/comfortable)
- [x] People count + depth stat pill in toolbar

### Phase 3 — New Features ✅
- [x] Actor tracking wired into audit log
- [x] Audit log viewer page (/admin/audit) with pagination
- [x] n8n workflow for Google Sheets sync (human-in-the-loop)
- [x] Photo management page (/admin/photos) with upload/delete
- [x] Delete cascade warning for people with direct reports

### Phase 4 — UX Polish ✅
- [x] Dashboard stat cards are clickable (link to filtered team views)
- [x] shadcn tooltips on dashboard cards and sidebar (collapsed state)
- [x] Sidebar tooltips for all nav items, quick actions, and footer when collapsed
- [x] Print page restyled to match Department Grid view layout
- [x] Print respects current theme (light/dark mode friendly)
- [x] Login page uses dotted background pattern (matches chart view)
- [x] Login inputs styled with depth/inset effect
- [x] Team page reads URL params (?tab=, ?filter=) for deep linking from dashboard

## Remaining

### For Mark (production + data)

- [ ] 🔴 Set `SESSION_SECRET` env var (min 32 chars) before production deploy — see `.env.example`
- [ ] 🟡 Change default account passwords after first deploy
- [ ] 🟡 Deploy to production (Docker on VPS)
- [ ] 🟢 Configure Google Sheets URL for real org data (currently uses sample)
- [ ] 🟡 Populate with real team data (or import via CSV/Google Sheets)
- [ ] 🟢 Add team photos

---

## Quick Facts

| | |
|---|---|
| **Stack** | Next.js 16 + React 19 + TypeScript + Tailwind v4 |
| **Database** | SQLite + Drizzle ORM |
| **Port** | 3000 |
| **Package Manager** | pnpm |
| **Auth** | JWT + bcrypt (Editor/Viewer roles) |
| **Deployment** | Docker / Docker Compose |
