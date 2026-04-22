# RS Auto Org Chart Generator — TODO

> Status: Working — feature-complete, needs production env config
> Last updated: 2026-04-22

---

## What's Done

- [x] 4 chart views (top-down, horizontal, collapsible, department grid)
- [x] Full CRUD admin for people and departments
- [x] CSV import
- [x] Google Sheets sync (configure URL in Settings → "Sync Now")
- [x] Audit logging
- [x] Role-based auth (Editor/Viewer) with bcrypt + JWT
- [x] Export: Excel, PDF, chart-to-image (PNG)
- [x] Dark/light mode, keyboard navigation, undo/redo
- [x] Seeded default accounts (admin/editor/viewer)
- [x] Next.js 16 compatibility (middleware → proxy migration)

## Remaining

### For Ken (production)

- [ ] 🔴 Set `SESSION_SECRET` env var (min 32 chars) before production deploy — see `.env.example`
- [ ] 🟡 Change default account passwords after first deploy
- [ ] 🟡 Deploy to production (Docker on VPS) if not already live
- [ ] 🟢 Configure Google Sheets URL for real org data (currently uses sample)

### For Mark

- [ ] 🟡 Populate with real team data (or import via CSV/Google Sheets)
- [ ] 🟢 Add team photos if desired

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
