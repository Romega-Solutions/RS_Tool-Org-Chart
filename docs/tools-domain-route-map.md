# Tools Domain Route Map

`tools.romega-solutions.com` is owned by the Org Chart deployment and acts as the shared entry point for Romega internal tools.

## Public Routes

| Route | Destination | Notes |
| --- | --- | --- |
| `/` | Tools home | Primary directory page for internal tools. Must return `200` without a public redirect. |
| `/portal` | `https://portal.romega-solutions.com/` | Employee Portal entry point. |
| `/ticketing` | `https://portal.romega-solutions.com/` | Legacy alias for Employee Portal. Keep only for old links and bookmarks. |
| `/org-chart/chart` | Org Chart app | Protected Org Chart workspace route. Anonymous users redirect to login. |
| `/email-signature` | Email Signature app | Proxied through the tools domain so users remain on `tools.romega-solutions.com`. |
| `/ats` | `https://rs-tool-ats.vercel.app/` | Redirects to the ATS deployment. |
| `/certificate-creator` | `https://rs-tool-romega-certificate-creator.vercel.app/` | Redirects to the Certificate Creator deployment. |
| `/job-scraper` | `https://rs-tool-job-scraper.vercel.app/` | Redirects to the Job Scraper deployment. |

## Alias Policy

`/ticketing` is a temporary legacy alias for `/portal`. Do not add new links to `/ticketing`; use `/portal` or `https://portal.romega-solutions.com/` for new references.

## Runtime Notes

The Org Chart app uses `NEXT_PUBLIC_BASE_PATH=/org-chart`, so the Docker runtime starts a small standalone wrapper in front of the generated Next.js server. The wrapper serves `/` by internally proxying `/org-chart/tools`, preventing the public `307 /org-chart/` hop while leaving all other routes unchanged.
