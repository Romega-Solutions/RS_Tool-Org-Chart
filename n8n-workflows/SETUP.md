# n8n Workflow: Org Chart Google Sheet Sync (Human-in-the-Loop)

## What It Does

```
Every day at 8am:
  1. Fetches the Google Sheet (employee list)
  2. Fetches the current org chart data via API
  3. Compares them — finds new hires, departures, title changes
  4. If changes found → emails Mark with a summary
  5. Mark reviews and manually approves via the Org Chart admin UI
  6. If no changes → does nothing
```

**Human in the loop:** Changes are NEVER auto-applied. The workflow only notifies. Mark decides whether to sync.

---

## Setup Steps

### 1. Import the Workflow

1. Open n8n: `https://n8n-romega-n8n.ikuuwb.easypanel.host/`
2. Go to **Workflows** → **Add Workflow** → **Import from File**
3. Select `orgchart-sync-workflow.json`
4. The workflow loads with 6 nodes

### 2. Configure the Org Chart URL

In the **"Fetch Current Org Chart"** node:
- Replace `http://localhost:3000` with the production org chart URL
- e.g., `https://orgchart.romega-solutions.com/api/people`

### 3. Configure Email

In the **"Email Mark for Review"** node:
- Verify the `sendTo` is correct (`mark@romega-solutions.com`)
- Configure SMTP credentials in n8n if not already set up
  - Or switch to a Gmail node / Slack node if preferred

### 4. Activate

- Toggle the workflow **Active**
- It will run daily at 8:00 AM

---

## How the Comparison Works

| Change Type | How It's Detected |
|---|---|
| **New hire** | Name in Google Sheet but not in org chart (active people) |
| **Departure** | Name in org chart but not in Google Sheet (Robbie is excluded) |
| **Title change** | Same name, different title |

---

## When Mark Gets an Email

The email looks like:

```
Org Chart Sync Report — 4/23/2026
=======================================

3 change(s) detected:

NEW HIRES (1):
  + Jane Doe — Marketing Intern (Marketing)

DEPARTURES (1):
  - Mickey Co — Marketing Intern (Marketing)

TITLE/ROLE CHANGES (1):
  ~ Duane Vargas: "HR Business Partner" → "AI Lead/Recruiter"

---
To apply: Log into Org Chart admin → Settings → Sync Now
```

### To Apply Changes

**Option A — Use the built-in sync** (if sheet columns match):
1. Go to Org Chart → Settings → Google Sheets Sync
2. Paste the published CSV URL
3. Click "Sync Now"

**Option B — Manual update:**
1. Go to Org Chart → Admin → People
2. Add/edit/deactivate people based on the email

---

## Google Sheet Requirements

The Google Sheet at `gid=0` must remain the source of truth with columns:
- `No.` — Row number
- `Name` — Full name
- `Role/Position` — Job title
- `Team` — Department
- `Work Email` — Email address

The workflow parses these columns automatically.

---

## Notes

- Robbie Galoso is excluded from departure detection (he's leadership, not in the IC sheet)
- The workflow does NOT auto-apply changes — it only notifies
- To change the schedule: edit the "Daily 8am Check" node
- To add Slack notifications: replace the email node with a Slack node
