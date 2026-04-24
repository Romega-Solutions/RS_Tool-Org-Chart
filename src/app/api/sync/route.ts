import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { people, departments, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Papa from "papaparse";
import { requireEditor } from "@/lib/auth";

interface CsvRow {
  name: string;
  title: string;
  department: string;
  reports_to_name: string;
  photo_filename: string;
}

export async function POST(request: Request) {
  const [, authErr] = await requireEditor(request);
  if (authErr) return authErr;
  // Get sheets_url from request body OR from settings
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

  // Fetch the CSV from the URL
  let text: string;
  try {
    const res = await fetch(sheetsUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch sheet. Check the URL and try again." },
      { status: 502 }
    );
  }

  // Parse CSV — same logic as /api/import
  const { data, errors } = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });
  if (errors.length > 0) {
    return NextResponse.json({ error: "CSV parse error", details: errors }, { status: 400 });
  }

  const results: Array<{ row: number; name: string; status: "created" | "updated" | "error"; message?: string }> = [];
  const nameToId = new Map<string, number>();
  const existing = db.select().from(people).all();
  for (const p of existing) nameToId.set(p.name.toLowerCase(), p.id);
  const deptRows = db.select().from(departments).all();
  const deptByName = new Map<string, number>();
  for (const d of deptRows) deptByName.set(d.name.toLowerCase(), d.id);

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row.name || !row.title || !row.department) {
      results.push({ row: i + 1, name: row.name || "(empty)", status: "error", message: "Missing required field" });
      continue;
    }
    const deptId = deptByName.get(row.department.toLowerCase());
    if (!deptId) {
      results.push({ row: i + 1, name: row.name, status: "error", message: `Department "${row.department}" not found` });
      continue;
    }
    const existingId = nameToId.get(row.name.toLowerCase());
    if (existingId) {
      db.update(people).set({
        title: row.title,
        departmentId: deptId,
        ...(row.photo_filename && { photoUrl: `/uploads/photos/${row.photo_filename}` }),
        updatedAt: new Date().toISOString(),
      }).where(eq(people.id, existingId)).run();
      results.push({ row: i + 1, name: row.name, status: "updated" });
    } else {
      const inserted = db.insert(people).values({
        name: row.name,
        title: row.title,
        departmentId: deptId,
        photoUrl: row.photo_filename ? `/uploads/photos/${row.photo_filename}` : null,
      }).returning().get();
      nameToId.set(row.name.toLowerCase(), inserted.id);
      results.push({ row: i + 1, name: row.name, status: "created" });
    }
  }

  // Second pass: set reports_to
  for (const row of data) {
    if (row.reports_to_name) {
      const personId = nameToId.get(row.name.toLowerCase());
      const managerId = nameToId.get(row.reports_to_name.toLowerCase());
      if (personId && managerId) {
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
  const errors2 = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    results,
    summary: { created, updated, errors: errors2, total: data.length },
  });
}
