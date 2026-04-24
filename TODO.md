# RS Auto Org Chart Generator — TODO

> Status: Feature-complete + security-hardened — ready for production deployment
> Last updated: 2026-04-24

---

## What's Done

### Core Features
- [x] 3 chart views (top-down, horizontal, department grid)
- [x] Full CRUD admin for people and departments
- [x] CSV import (10MB limit)
- [x] Google Sheets sync (configure URL in Settings → "Sync Now")
- [x] Audit logging
- [x] Role-based auth (Editor/Viewer) with bcrypt + JWT
- [x] Export: Excel (styled with ExcelJS), PNG (HD 2x, dotted bg, theme-aware), PDF, print
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
- [x] Photo management page (/admin/photos) with upload/delete/assign
- [x] Delete cascade warning for people with direct reports

### Phase 4 — UX Polish ✅
- [x] Dashboard stat cards are clickable (link to filtered team views)
- [x] shadcn tooltips on dashboard cards and sidebar (collapsed state)
- [x] Print page restyled to match Department Grid view layout
- [x] Login page uses dotted background pattern (matches chart view)
- [x] Team page reads URL params (?tab=, ?filter=) for deep linking from dashboard

### Phase 5 — Photos Enhancement ✅
- [x] Multi-file drag-and-drop upload with confirmation dialog
- [x] Auto-filter unsupported file types with skip notice
- [x] Upload progress counter (Uploading 2/5...)
- [x] Assign unused photos to people from gallery (person picker dialog with search)
- [x] Missing Photos dialog from clickable stat card (replaces separate panel)
- [x] Click-to-assign from Missing Photos — upload + auto-assign in one step
- [x] Stats bar: Total Photos, Assigned, Unused, Missing + coverage progress bar
- [x] Empty state: dashed drop zone with inset shadow
- [x] Skeleton loading, error state with retry
- [x] Photo cards: hover scale + overlay with Assign/Delete buttons
- [x] All uploads auto-converted to WebP for performance

### Phase 6 — Export Improvements ✅
- [x] PNG: edge/connection lines preserved (CSS variable inlining)
- [x] PNG: auto-fit zoom before capture (not zoomed out)
- [x] PNG: dotted background pattern on chart area
- [x] PNG: HD 2x with scaled header/footer text
- [x] PNG: logo theme-aware (inverted in dark mode)
- [x] PNG: date in header (replaced redundant org name)
- [x] PNG: larger logo matching header height
- [x] Excel: migrated from xlsx to ExcelJS (styled)
- [x] Excel: RS primary blue header, alternating rows, borders, auto-filters
- [x] Excel: department color swatches with contrast-aware text
- [x] Excel: frozen header rows

### Phase 7 — Security Hardening ✅
- [x] Auth required on all GET endpoints (viewers can read, anonymous blocked)
- [x] Editor role required on all write endpoints (POST/PATCH/DELETE)
- [x] CSRF protection via Origin header validation
- [x] Login brute-force protection (10 failed attempts per 15 min → lockout, clears on success)
- [x] Session secret: fatal error in production if SESSION_SECRET not set
- [x] Proxy/middleware key synced with session.ts
- [x] API key timing-safe comparison (crypto.timingSafeEqual)
- [x] Input validation: string length, hex color (#RRGGBB), integer ranges
- [x] Import file size limit (10MB)
- [x] Sync error message sanitized (no raw error leak)
- [x] Upload: auth + rate limit + file type/size + disk quota + WebP conversion
- [x] Security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- [x] API Cache-Control: no-store
- [x] DDoS: 3-layer rate limiting (Nginx → middleware → app handlers)
- [x] Nginx reverse proxy (app not directly exposed)
- [x] VPS hardening script (scripts/harden-vps.sh): UFW, SSH, Fail2ban, HTTPS, backups, unattended upgrades

### Phase 8 — Account Management ✅
- [x] Change password page (/account) — accessible by editors and viewers
- [x] POST /api/auth/change-password — CSRF, auth, validation (min 8 chars, max 128)
- [x] Password strength meter (Weak/Fair/Good/Strong) with animated bar
- [x] 5-point requirement checklist (length, upper, lower, number, special)
- [x] Inline validation: confirm match check on blur
- [x] Auto-logout after password change (3s countdown with progress bar)
- [x] Sidebar "Change Password" link
- [x] Audit logged

## Remaining

### For Ken (deployment)

- [ ] 🔴 Run `sudo ./scripts/harden-vps.sh` on VPS (sets up UFW, SSH, Fail2ban, HTTPS, backups, SESSION_SECRET)
- [ ] 🔴 Deploy: `docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --build`
- [ ] 🔴 Change default account passwords via /account page after first login

### For Mark (data)

- [ ] 🟡 Populate with real team data (CSV import or Google Sheets sync)
- [ ] 🟢 Configure Google Sheets URL for live org data
- [ ] 🟢 Upload team photos

---

## Quick Facts

| | |
|---|---|
| **Stack** | Next.js 16 + React 19 + TypeScript + Tailwind v4 + ExcelJS |
| **Database** | SQLite + Drizzle ORM |
| **Port** | 3000 (internal), 80/443 via Nginx |
| **Package Manager** | pnpm |
| **Auth** | JWT + bcrypt (Editor/Viewer roles) |
| **Deployment** | Docker Compose + Nginx + Certbot |
| **Security** | 3-layer DDoS, CSRF, rate limiting, HTTPS, Fail2ban |
| **Tests** | Playwright e2e (19 tests) |
