# Production Readiness Update — 2026-05-05

## Current Status

The org chart app is deployed and the repository is clean on `master`.

- Live URL: `https://romega-projects-rs-tool-org-chart.ikuuwb.easypanel.host`
- Latest pushed checkpoint: `c238515 chore(qa): make photo gallery tests deterministic checkpoint`
- Latest GitHub Actions deploy run passed CI, deploy, and live verification.
- Live site returns `200` with title `Org Chart - Romega Solutions`.
- Follow-up live checks found the active deployment is stale for account management: `/account` and `/api/auth/change-password` return `404` even though those routes exist on `master`.

## What Changed

### CI/CD and Deployment

- Added a gated GitHub Actions deployment flow.
- CI now runs install, lint, build, Playwright Chromium tests, deploy, and live title verification.
- Updated workflow actions to current Node runtime versions.
- Removed the old Node 20 forced-runtime annotation.
- Suppressed only the `DEP0040` punycode warning emitted by setup tooling.

### Branch and Repo Cleanup

- Deleted stale remote branches:
  - `origin/feature/phase1-bug-fixes`
  - `origin/copilot/bug-analysis`
- Deleted stale local branch:
  - `feature/phase3-photo-management`
- Confirmed `master` is synced with `origin/master`.

### QA Coverage

- Added permanent product QA coverage for:
  - people create/edit/delete
  - photo upload, WebP conversion, assignment, table display, and gallery display
  - chart rendering, search, and view switching
  - Excel and PNG export downloads
  - print-ready chart page
  - audit entries
  - viewer permission blocking
  - mobile chart/photos smoke checks
- Stabilized the Department sort test.
- Set Playwright workers to `1` because the E2E suite shares SQLite and upload storage.
- Replaced data-dependent skipped photo-gallery tests with deterministic disposable fixtures.

## Verified

Local verification:

- `pnpm lint` passed.
- `npx playwright test --browser=chromium` passed with `47 passed` and no skipped tests.

GitHub Actions verification:

- Latest deploy workflow passed.
- CI, deploy, and live verification steps completed successfully.

Production smoke verification:

- Live chart renders active org data.
- Chart search works.
- Department grid view works.
- Admin photos page renders.
- Excel export downloads.
- PNG export downloads.
- Print view renders.
- Mobile chart smoke passes.

Production data snapshot:

- 37 total people
- 22 active people
- 7 departments
- 50 audit entries
- 0 uploaded production photos

## Remaining Blocker

Default seeded credentials still work in production:

- `admin / admin123`
- `editor / editor123`
- `viewer / viewer123`

This must be fixed before calling the rollout stable.

Live rotation cannot be completed until the active Easypanel deployment exposes the base-path account-management routes:

- `/org-chart/account`
- `/org-chart/api/auth/change-password`

## Domain Direction

The current Easypanel URL is working, but the preferred long-term domain is:

`tools.romega-solutions.com/org-chart`

Reason:

- This app is part of the broader `RS_Tool` family.
- A single tools domain can later host or route to other internal tools.
- Future routes can follow the same pattern:
  - `tools.romega-solutions.com/org-chart`
  - `tools.romega-solutions.com/ticketing`
  - `tools.romega-solutions.com/reports`

Recommended rollout:

1. Point `tools.romega-solutions.com` to the current org chart app first.
2. Serve the org chart at `/org-chart`.
3. Make `/` redirect to `/org-chart` or show a simple tools index later.
4. Enable and verify HTTPS on the custom domain.
5. Update README, TODO, and live references from the Easypanel URL to the custom domain after it is verified.

## Next Steps

1. Add `EASYPANEL_DEPLOY_WEBHOOK` to the `VPS_HOST` GitHub environment secrets.
2. Run the GitHub Actions deploy workflow and verify `/org-chart/account` and `POST /org-chart/api/auth/change-password` pass live deep-route checks.
3. Change all live default account passwords through `/org-chart/account` or `POST /org-chart/api/auth/change-password`.
4. Re-test default logins and confirm they fail.
5. Confirm the new admin/editor/viewer credentials work.
6. Configure and verify `tools.romega-solutions.com/org-chart`.
7. Re-run the live smoke checks.
8. Mark the rollout stable after the password and domain tasks are closed.
