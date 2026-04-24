# RS-Auto-Org_Chart-Generator

Auto-generating organizational chart tool for Romega Solutions.

## Quick Start (Development)

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

Change passwords after first login.

## Production Deployment

### Option A: Fresh VPS (recommended)

```bash
# 1. Clone to VPS
git clone <repo-url> /opt/orgchart && cd /opt/orgchart

# 2. Run hardening script (interactive — asks for domain + email)
sudo ./scripts/harden-vps.sh

# 3. Deploy
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d --build
```

The hardening script configures: UFW firewall, SSH hardening, Fail2ban, HTTPS (Let's Encrypt), unattended upgrades, Docker log rotation, daily backups, and generates `SESSION_SECRET`.

### Option B: Existing server

```bash
cp .env.example .env    # Edit — set SESSION_SECRET (required)
docker compose up -d --build
```

### Post-deploy checklist

- [ ] Change default account passwords
- [ ] Configure Google Sheets URL in Settings (optional)
- [ ] Populate with real team data via CSV import or Google Sheets sync

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | **Yes (production)** | JWT signing key, min 32 chars. App refuses to start without it in production. Generate: `openssl rand -base64 32` |
| `CRON_SECRET` | No | Bearer token for `/api/sync/cron`. Enables auto-sync sidecar. |
| `SYNC_INTERVAL` | No | Auto-sync interval: `1h`, `6h`, `12h`, `24h`, or `off` (default). |
| `API_KEY` | No | API key for external integrations (n8n, AI agents). Grants editor access via `X-API-Key` header. |

## Tech Stack

Next.js 16, React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui, Drizzle ORM, SQLite (better-sqlite3), React Flow, ExcelJS, Sharp, bcryptjs, jose.

## Features

- **3 chart views:** top-down tree, horizontal tree, department grid with density toggle
- **Full CRUD admin:** people, departments, CSV import/export, Google Sheets sync, branding settings
- **People table:** status filtering (Active/Inactive/All), multi-column sorting (A-Z, Senior first, by department), quick filter suggestions, saved filter views, shift+click range select, inline edit via row click, CSV export
- **Photo management:** multi-file drag-and-drop upload, assign from gallery, missing photos dialog, auto-convert to WebP
- **Export:** Excel (styled with ExcelJS), PNG (HD 2x, theme-aware with dotted background), PDF, print, CSV (people table)
- **Interactive dashboard** with clickable stat cards
- **Audit log:** every create/update/delete/toggle tracked
- **Soft delete with undo:** deactivating people shows an undo toast to reactivate
- **Role-based auth:** editor (full access) vs. viewer (read-only chart)
- **API integration:** `X-API-Key` header auth for n8n, AI agents, external scripts. In-app API docs in Settings.
- **JWT sessions** via HTTP-only, SameSite=lax cookies
- **Dark/light mode**, keyboard navigation, undo/redo
- **Mobile responsive:** people table adapts with progressive column hiding, inline titles, horizontal scroll
- **Accessibility:** aria-sort on table headers, aria-labels on all controls, skeleton loading, tabular-nums, focus management

## API Reference

All endpoints require authentication. Use session cookies (browser) or `X-API-Key` header (external systems).

### People

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/people` | Any user | List people (`?includeInactive=true`) |
| `GET` | `/api/people/:id` | Any user | Get person |
| `POST` | `/api/people` | Editor | Create person |
| `PATCH` | `/api/people/:id` | Editor | Update person |
| `DELETE` | `/api/people/:id` | Editor | Delete person |
| `PATCH` | `/api/people/:id/toggle` | Editor | Toggle active/inactive |
| `PATCH` | `/api/people/reassign` | Editor | Reassign reporting line |

### Departments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/departments` | Any user | List departments |
| `POST` | `/api/departments` | Editor | Create department |
| `PATCH` | `/api/departments/:id` | Editor | Update department |
| `DELETE` | `/api/departments/:id` | Editor | Delete department |

### Chart & Data

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/chart-data` | Any user | Full org chart tree |
| `GET` | `/api/audit` | Any user | Audit log (`?page=1&limit=50`) |
| `GET` | `/api/photos` | Any user | List uploaded photos |
| `DELETE` | `/api/photos/:filename` | Editor | Delete photo + clear person reference |

### System

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/settings` | Any user | Get settings |
| `PATCH` | `/api/settings` | Editor | Update settings |
| `POST` | `/api/import` | Editor | CSV import (max 10MB) |
| `POST` | `/api/sync` | Editor | Google Sheets sync |
| `GET` | `/api/sync/cron` | Bearer token | Scheduled sync trigger |
| `POST` | `/api/upload` | Editor | Upload photo (max 5MB, rate limited) |

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/login` | None | Login (rate limited) |
| `POST` | `/api/auth/logout` | None | Logout |
| `GET` | `/api/auth/me` | None | Get current user (returns null if not logged in) |

### Examples

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Create person (with API key)
curl -X POST http://localhost:3000/api/people \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","title":"Engineer","departmentId":3}'

# Get full org chart
curl http://localhost:3000/api/chart-data \
  -H "X-API-Key: YOUR_KEY"
```

## Security

### Application layer

- All API endpoints require authentication
- Write operations require editor role
- CSRF protection via Origin header validation
- Login brute-force protection (10 failed attempts per 15 min → lockout)
- Upload: 5MB/file, 500MB disk quota, 30/min per user, WebP auto-conversion
- Import: 10MB file size limit
- API key uses `crypto.timingSafeEqual` (timing-attack safe)
- Input validation: string length, hex color, integer ranges
- Path traversal protection on file operations
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
- API responses: `Cache-Control: no-store`
- Session secret: fatal error in production if not set

### Infrastructure layer (via `scripts/harden-vps.sh`)

- Nginx reverse proxy (app not directly exposed)
- UFW firewall (ports 22, 80, 443 only)
- SSH hardening (no root, no password, key-only)
- Fail2ban (SSH + Nginx + bot scans)
- HTTPS with Let's Encrypt (TLSv1.2+, HSTS, auto-renewal)
- Unattended security updates
- Docker log rotation (10MB x 3)
- Daily backups (SQLite + uploads, 14-day retention)

### DDoS protection (3 layers)

| Layer | Where | Limits |
|-------|-------|--------|
| Nginx | Edge | 30 req/s general, 10 req/s API, 3 req/min login, 5 req/min upload, 20 conn/IP |
| Next.js middleware | App | 200 req/min per IP |
| App handlers | Route | 30 uploads/min per user, 10 login failures/15 min per user |

## Architecture

```
Client → Nginx:80/443 → orgchart:3000 (Docker internal)
                              ├── Next.js App Router
                              ├── Drizzle ORM → SQLite (data/orgchart.db)
                              ├── Sharp → public/uploads/photos/ (WebP)
                              └── JWT auth (jose + bcryptjs)
```

## Docker Compose Services

| Service | Purpose |
|---------|---------|
| `nginx` | Reverse proxy, rate limiting, HTTPS termination |
| `orgchart` | Next.js app (internal port 3000) |
| `sync-cron` | Google Sheets auto-sync sidecar (optional) |
| `certbot` | SSL certificate auto-renewal (production only) |
| `backup` | Daily SQLite + uploads backup (production only) |

## Development

```bash
pnpm dev                      # Dev server on :3000
pnpm build                    # Production build (type-checks)
pnpm lint                     # ESLint
pnpm start                    # Start production build
npx playwright test e2e/      # E2E tests
```
