import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { people, departments, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Papa from "papaparse";
import { requireEditor } from "@/lib/auth";

// Default department colors for auto-creation
const DEPT_COLORS: Record<string, string> = {
  "executive": "#6366f1",
  "hr/finance": "#ec4899",
  "marketing": "#f59e0b",
  "marketing intelligence": "#8b5cf6",
  "sales": "#10b981",
  "tech": "#3b82f6",
  "operations": "#64748b",
};

function pickDeptColor(name: string): string {
  const key = name.toLowerCase();
  for (const [pattern, color] of Object.entries(DEPT_COLORS)) {
    if (key.includes(pattern)) return color;
  }
  // Generate a stable color from the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 50%)`;
}

/** Normalize column headers — accepts multiple formats flexibly */
function mapRow(raw: Record<string, string>): {
  name: string;
  title: string;
  department: string;
  reportsTo: string;
  photo: string;
  email: string;
} {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const val = raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()];
      if (val?.trim()) return val.trim();
    }
    // Case-insensitive fallback
    for (const [k, v] of Object.entries(raw)) {
      const lower = k.toLowerCase().trim();
      for (const candidate of keys) {
        if (lower === candidate.toLowerCase() || lower.includes(candidate.toLowerCase())) {
          if (v?.trim()) return v.trim();
        }
      }
    }
    return "";
  };

  return {
    name: get("name", "Name", "Full Name", "full_name"),
    title: get("title", "role/position", "Role/Position", "role", "position", "job_title"),
    department: get("department", "team", "Team", "dept"),
    reportsTo: get("reports_to_name", "reports_to", "Reports To", "manager", "Manager"),
    photo: get("photo_filename", "photo", "Photo", "photo_url"),
    email: get("email", "work email", "Work Email", "work_email"),
  };
}

/** Split multi-department entries — returns the primary department */
function parsePrimaryDepartment(raw: string): string {
  // "HR/Finance & Tech" → "HR/Finance" (first before &)
  // "Marketing & Sales" → "Marketing"
  const parts = raw.split(/\s*&\s*/);
  return parts[0].trim();
}

export async function POST(request: Request) {
  const [, authErr] = await requireEditor(request);
  if (authErr) return authErr;

  let sheetsUrl: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    sheetsUrl = body.url ?? null;
  } catch { /* ignore */ }

  if (!sheetsUrl) {
    const setting = db.select().from(settings).where(eq(settings.key, "sheets_url")).get();
    sheetsUrl = setting?.value ?? null;
  }

  if (!sheetsUrl) {
    return NextResponse.json(
      { error: "No sheets_url configured. Set it in Settings first." },
      { status: 400 }
    );
  }

  // Convert Google Sheets edit URL to CSV export URL
  const sheetIdMatch = sheetsUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  let csvUrl = sheetsUrl;
  if (sheetIdMatch) {
    const sheetId = sheetIdMatch[1];
    // Check for gid= param (specific sheet tab)
    const gidMatch = sheetsUrl.match(/gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }

  let text: string;
  try {
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch sheet. Check the URL and try again." },
      { status: 502 }
    );
  }

  const { data, errors } = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  if (errors.length > 0) {
    return NextResponse.json({ error: "CSV parse error", details: errors }, { status: 400 });
  }

  // Map rows to normalized format
  const rows = data.map(mapRow).filter((r) => r.name && r.title);

  const results: Array<{ row: number; name: string; status: "created" | "updated" | "skipped" | "error"; message?: string }> = [];
  const nameToId = new Map<string, number>();
  const existing = db.select().from(people).all();
  for (const p of existing) nameToId.set(p.name.toLowerCase(), p.id);
  const deptRows = db.select().from(departments).all();
  const deptByName = new Map<string, number>();
  for (const d of deptRows) deptByName.set(d.name.toLowerCase(), d.id);
  let nextDeptOrder = deptRows.length;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.department) {
      results.push({ row: i + 1, name: row.name, status: "error", message: "Missing department" });
      continue;
    }

    // Handle multi-department — use primary
    const deptName = parsePrimaryDepartment(row.department);
    let deptId = deptByName.get(deptName.toLowerCase());

    // Auto-create department if it doesn't exist
    if (!deptId) {
      const color = pickDeptColor(deptName);
      const inserted = db.insert(departments).values({
        name: deptName,
        color,
        displayOrder: nextDeptOrder++,
      }).returning().get();
      deptId = inserted.id;
      deptByName.set(deptName.toLowerCase(), deptId);
    }

    const existingId = nameToId.get(row.name.toLowerCase());
    const photoUrl = row.photo ? (row.photo.startsWith("/") || row.photo.startsWith("http") ? row.photo : `/uploads/photos/${row.photo}`) : null;

    if (existingId) {
      db.update(people).set({
        title: row.title,
        departmentId: deptId,
        ...(photoUrl && { photoUrl }),
        updatedAt: new Date().toISOString(),
      }).where(eq(people.id, existingId)).run();
      results.push({ row: i + 1, name: row.name, status: "updated" });
    } else {
      const inserted = db.insert(people).values({
        name: row.name,
        title: row.title,
        departmentId: deptId,
        photoUrl,
      }).returning().get();
      nameToId.set(row.name.toLowerCase(), inserted.id);
      results.push({ row: i + 1, name: row.name, status: "created" });
    }
  }

  // Second pass: set reports_to hierarchy
  for (const row of rows) {
    if (row.reportsTo) {
      const personId = nameToId.get(row.name.toLowerCase());
      const managerId = nameToId.get(row.reportsTo.toLowerCase());
      if (personId && managerId && personId !== managerId) {
        db.update(people).set({ reportsTo: managerId }).where(eq(people.id, personId)).run();
      }
    }
  }

  // Update last_sync_at
  const now = new Date().toISOString();
  db.insert(settings)
    .values({ key: "last_sync_at", value: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: now } })
    .run();

  const created = results.filter((r) => r.status === "created").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const errCount = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    results,
    summary: { created, updated, errors: errCount, total: rows.length },
  });
}
