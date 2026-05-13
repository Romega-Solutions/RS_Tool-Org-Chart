# RS Auto Org Chart Generator — TODO

> Status: Deployed with CI/CD, custom domain, rotated live passwords, headless API key, n8n/MCP workflow assets, sheet sync, managed photos, and live product QA. Latest checkpoint `d682c49` is pushed and live.
> Last updated: 2026-05-07

---

## What's Done

### May 2026 — Deployment, CI/CD, and QA ✅
- [x] GitHub Actions deploy workflow gates production deployment behind install, lint, build, Playwright Chromium tests, deploy, and live URL verification
- [x] Workflow actions updated off deprecated Node 20 runtime annotations
- [x] CI log noise cleaned up (`DEP0040` punycode warning suppressed only for that warning code)
- [x] Stale local/remote branches removed
- [x] Product QA pass completed against disposable local data
- [x] Permanent product-flow Playwright spec added for CRUD, photos, chart views/search, export, print, audit, permissions, and mobile smoke
- [x] Photo-gallery assignment tests made deterministic with disposable fixtures
- [x] Full Playwright suite is now deterministic: 60 passing tests, no skips
- [x] Live production smoke passed for chart, search, grid view, photos empty state, Excel/PNG export, print view, and mobile chart
- [x] Production readiness snapshot documented in `docs/production-readiness-2026-05-05.md`
- [x] May 7 live product QA passed for login, chart render, Duane secondary connector, hidden placeholder records, disposable people CRUD, photo upload/display, crop/zoom, Excel export, print view, mobile layout, Sync Now, and cleanup unused photos
- [x] Weekly live QA script added for public route, protected API, Google Sheet CSV, and n8n MCP endpoint checks
- [x] Weekly live QA MCP check now verifies production MCP initialize plus `tools/list`

### Core Features
- [x] 3 chart views (top-down, horizontal, department grid)
- [x] Full CRUD admin for people and departments
- [x] CSV import (10MB limit)
- [x] Google Sheets sync (configure URL in Settings → "Sync Now")
- [x] Google Sheets status sync for resigned/inactive people
- [x] Google Sheets sync hardening for managed WebP photo source changes, omitted secondary-reporting columns, and technical department aliases
- [x] Google Sheets sync review is visible in Settings with created/updated/error counts, status changes, reporting changes, photo changes, protected photos, and warnings
- [x] Google Sheets sync dry-run preview is available in Settings and through `POST /api/sync` with `dryRun: true`
- [x] Audit logging
- [x] Role-based auth (Editor/Viewer) with bcrypt + JWT
- [x] Export: Excel (styled with ExcelJS), PNG (HD 2x, dotted bg, theme-aware), PDF, print
- [x] Dark/light mode, keyboard navigation, undo/redo
- [x] Seeded default accounts (admin/editor/viewer/visitor)
- [x] Rotatable public read-only onboarding link with 90-day expiry
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
- [x] Combined n8n MCP + Google Sheets review workflow JSON
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
- [x] Import external sheet/Drive photo URLs into managed `/admin/photos` storage
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

### May 6 production/domain/n8n update

- `tools.romega-solutions.com` DNS points to `51.83.97.146`.
- Easypanel routes `tools.romega-solutions.com` to the org chart app over HTTP port `80`.
- Public org chart URL is `https://tools.romega-solutions.com/org-chart`.
- Easypanel fallback URL is `https://romega-projects-rs-tool-org-chart.ikuuwb.easypanel.host/org-chart`.
- Live account routes are available.
- Live passwords for `admin`, `editor`, and `viewer` were rotated.
- Old default passwords were verified to fail.
- `visitor` is a seeded read-only viewer account for employees and onboarding users.
- Public view links are generated alphanumeric codes, admin-rotatable in Settings, and expire after 90 days.
- `API_KEY` is configured for live headless/API access.
- `API_KEY` is also present in the GitHub `VPS_HOST` environment for future workflow use.
- n8n workflow JSON now includes MCP tools and daily Google Sheets review.
- Production n8n MCP workflow is active and uses the Easypanel internal org chart service URL from n8n.
- New Google Sheet tab `gid=947755283` was selected for review/sync isolation from the old tab.
- The new tab exports HTTP 200 and is now populated with team data used by Sync Now.

### May 7 live QA and latest checkpoint

- [x] 🟢 Created checkpoint commit `aa26ea8 fix(auth): checkpoint base path redirects`
- [x] 🟢 Pushed `master` to GitHub
- [x] 🟢 GitHub Actions deploy run `25443129282` completed successfully
- [x] 🟢 Verified `https://tools.romega-solutions.com/org-chart/login` returns HTTP 200
- [x] 🟢 Verified live login lands on `/org-chart/chart` without the doubled `/org-chart/org-chart` path
- [x] 🟢 Verified `/org-chart/api/people?includeInactive=true` returns HTTP 200
- [x] 🟢 Verified live chart renders with Duane's dashed secondary connector after Sync Now
- [x] 🟢 Verified `/admin/team` and `/admin/photos` hide org placeholder records
- [x] 🟢 Verified disposable live people CRUD, photo upload, crop/zoom, photo display, Excel export, print view, mobile chart layout, Sync Now, and cleanup unused photos
- [x] 🟢 Verified underlying n8n tool target APIs: departments, audit log, and people endpoints return HTTP 200 with `X-API-Key`
- [x] 🟢 Verified production n8n MCP URL initializes, lists 9 tools, and calls `list_departments` and `read_audit_log`
- [x] 🟢 Fixed live n8n workflow HTTP/tool node URLs to use `http://romega-projects_rs_tool-org-chart:80/org-chart` from inside Easypanel
- [x] 🟢 Fixed live n8n Gmail credential binding for the scheduled sheet review email node

### Domain consolidation

- [x] 🟢 Configure final custom domain as `tools.romega-solutions.com/org-chart`
- [x] 🟢 Point `tools.romega-solutions.com` DNS to the current deployed app
- [x] 🟢 Add the custom domain in Easypanel and verify HTTPS
- [x] 🟢 Decide whether `/` redirects to `/org-chart` or becomes a simple tools index for this repo: root redirects to `/org-chart/chart`
- [x] 🟢 Update README/TODO/live references after the custom domain is verified

### For Mark (data)

- [x] 🟢 Populate the new Google Sheet tab with headers/data before running sync
- [x] 🟢 Configure Google Sheets URL for n8n review using `gid=947755283`
- [x] 🟢 Import sheet-mapped Drive photos into live `/admin/photos` after sync review

---

## Quick Facts

| | |
|---|---|
| **Stack** | Next.js 16 + React 19 + TypeScript + Tailwind v4 + ExcelJS |
| **Database** | SQLite + Drizzle ORM |
| **Port** | 3000 (internal), 80/443 via Nginx |
| **Package Manager** | pnpm |
| **Auth** | JWT + bcrypt (Editor/Viewer roles) |
| **Deployment** | GitHub Actions → VPS/Easypanel live deploy |
| **Production Domain** | tools.romega-solutions.com/org-chart |
| **Security** | 3-layer DDoS, CSRF, rate limiting, HTTPS, Fail2ban |
| **Tests** | Playwright e2e (70 tests, no skips) |
