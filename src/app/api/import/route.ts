import { NextResponse } from "next/server";
import { db, persistOrgChartDbSnapshot } from "@/lib/db/client";
import { people, departments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Papa from "papaparse";
import { requireEditor, parseOptionalEmail } from "@/lib/auth";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const EMAIL_COLUMNS = ["email", "work email", "work_email"];

interface CsvRow {
  name: string;
  title: string;
  department: string;
  reports_to_name: string;
  photo_filename: string;
  email?: string;
  hasEmailColumn: boolean;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().trim().replace(/_/g, " ").replace(/\s+/g, " ");
}

function parseEmailColumn(row: Record<string, string>): { email: string; hasEmailColumn: boolean } {
  let email = "";
  let hasEmailColumn = false;

  for (const [key, rawValue] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    if (EMAIL_COLUMNS.includes(normalizedKey)) {
      hasEmailColumn = true;
      if (email === "" && rawValue?.trim()) {
        email = rawValue.trim();
      }
    }
  }

  return { email, hasEmailColumn };
}

export async function POST(request: Request) {
  const [, err] = await requireEditor(request);
  if (err) return err;
  const formData = await request.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File too large. Maximum size is 10MB." }, { status: 413 });

  const text = await file.text();
  const { data, errors } = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  if (errors.length > 0) return NextResponse.json({ error: "CSV parse error", details: errors }, { status: 400 });

  const results: Array<{ row: number; name: string; status: "created" | "updated" | "error"; message?: string }> = [];
  const nameToId = new Map<string, number>();
  const existing = db.select().from(people).all();
  for (const p of existing) nameToId.set(p.name.toLowerCase(), p.id);
  const deptRows = db.select().from(departments).all();
  const deptByName = new Map<string, number>();
  for (const d of deptRows) deptByName.set(d.name.toLowerCase(), d.id);

  for (let i = 0; i < data.length; i++) {
    const rawRow = data[i];
    const row = {
      ...rawRow,
      ...(parseEmailColumn(rawRow) as Pick<CsvRow, "email" | "hasEmailColumn">),
    } as CsvRow;

    if (!row.name || !row.title || !row.department) {
      results.push({ row: i + 1, name: row.name || "(empty)", status: "error", message: "Missing required field" });
      continue;
    }
    const emailValue = parseOptionalEmail(row.email);
    if (row.hasEmailColumn && row.email && emailValue.error) {
      results.push({ row: i + 1, name: row.name, status: "error", message: `Invalid email: ${emailValue.error}` });
      continue;
    }
    const hasEmail = row.hasEmailColumn;
    const deptId = deptByName.get(row.department.toLowerCase());
    if (!deptId) { results.push({ row: i + 1, name: row.name, status: "error", message: `Department "${row.department}" not found` }); continue; }

    const existingId = nameToId.get(row.name.toLowerCase());
    if (existingId) {
      db.update(people).set({
        title: row.title,
        departmentId: deptId,
        ...(hasEmail && { email: emailValue.value }),
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
        ...(hasEmail && { email: emailValue.value }),
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
      if (personId && managerId) db.update(people).set({ reportsTo: managerId }).where(eq(people.id, personId)).run();
    }
  }
  if (results.some((result) => result.status === "created" || result.status === "updated")) {
    await persistOrgChartDbSnapshot("import:csv");
  }
  return NextResponse.json({ results });
}
