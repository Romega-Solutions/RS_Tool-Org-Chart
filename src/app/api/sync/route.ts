import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { people, departments, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Papa from "papaparse";
import { requireEditor, parseOptionalEmail } from "@/lib/auth";
import { normalizeDrivePhotoUrl } from "@/lib/photo-storage";
import { getSheetPhotoSource, parseSecondaryReportsTo, setSecondaryReportsTo, setSheetPhotoSource } from "@/lib/secondary-reporting";

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
  secondaryReportsTo: string;
  photo: string;
  email: string;
  hasEmailColumn: boolean;
  isActive: boolean | null;
  hasPhotoColumn: boolean;
  hasReportsToColumn: boolean;
  hasSecondaryReportsToColumn: boolean;
} {
  const hasColumn = (...keys: string[]) => Object.keys(raw).some((key) => {
    const lower = key.toLowerCase().trim();
    return keys.some((candidate) => lower === candidate.toLowerCase());
  });

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

  const parseStatus = (value: string) => {
    const status = value.trim().toLowerCase();
    if (!status) return null;
    if (["active", "current", "employed", "yes", "true", "1"].includes(status)) return true;
    if (["resigned", "inactive", "offboarded", "ended", "terminated", "no", "false", "0"].includes(status)) return false;
    return null;
  };

  return {
    name: get("name", "Name", "Full Name", "full_name"),
    title: get("title", "role/position", "Role/Position", "role", "position", "job_title"),
    department: get("org chart team", "Org Chart Team", "primary team", "Primary Team", "display team", "Display Team", "department", "team", "Team", "dept"),
    reportsTo: get("reports_to_name", "reports_to", "Reports To", "manager", "Manager"),
    secondaryReportsTo: get("secondary reports to", "Secondary Reports To", "dotted reports to", "Dotted Reports To", "secondary manager", "Secondary Manager", "also reports to", "Also Reports To"),
    photo: get("photo_filename", "photo", "Photo", "photo_url"),
    email: get(
      "email",
      "work email",
      "Work Email",
      "work_email",
      "email address",
      "Email Address",
      "work email address",
      "Work Email Address"
    ),
    hasEmailColumn: hasColumn(
      "email",
      "work email",
      "Work Email",
      "work_email",
      "email address",
      "Email Address",
      "work email address",
      "Work Email Address"
    ),
    isActive: parseStatus(get("status", "Status", "is_active", "Is Active", "active", "Active")),
    hasPhotoColumn: hasColumn("photo_filename", "photo", "photo_url"),
    hasReportsToColumn: hasColumn("reports_to_name", "reports_to", "Reports To", "manager", "Manager"),
    hasSecondaryReportsToColumn: hasColumn("secondary reports to", "dotted reports to", "secondary manager", "also reports to"),
  };
}

/** Split multi-department entries — returns the primary department */
function parsePrimaryDepartment(raw: string): string {
  const parts = raw.split(/\s*&\s*/);
  return parts[0].trim();
}

function normalizeDepartmentName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function departmentAliases(name: string): string[] {
  const normalized = normalizeDepartmentName(name);
  const aliases = new Set([normalized]);

  if (["tech", "technical", "technology", "tech/ai", "tech ai"].includes(normalized)) {
    aliases.add("tech");
    aliases.add("technical");
  }

  if (["market intelligence", "marketing intelligence"].includes(normalized)) {
    aliases.add("market intelligence");
    aliases.add("marketing intelligence");
  }

  if (["hr", "finance", "hr/finance", "hr finance"].includes(normalized)) {
    aliases.add("hr/finance");
    aliases.add("hr finance");
  }

  return [...aliases];
}

/** Convert photo value to a usable URL — handles Google Drive links, direct URLs, and filenames */
function normalizePhotoUrl(raw: string): string {
  const trimmed = raw.trim();
  const normalizedDriveUrl = normalizeDrivePhotoUrl(trimmed);
  if (normalizedDriveUrl !== trimmed) return normalizedDriveUrl;
  // Already a URL
  if (trimmed.startsWith("http") || trimmed.startsWith("/") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  // Filename only
  return `/uploads/photos/${trimmed}`;
}

function toCsvExportUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const sheetIdMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!sheetIdMatch) return trimmed;
  const sheetId = sheetIdMatch[1];
  const gidMatch = trimmed.match(/(?:[?&#]|\b)gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function splitManagerNames(raw: string): string[] {
  return raw
    .split(/\s*(?:,|;|\||\n)\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function activeLabel(value: boolean | null | undefined) {
  if (value === null || value === undefined) return "Unknown";
  return value ? "Active" : "Inactive";
}

function sameNumberSet(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => x - y);
  const right = [...b].sort((x, y) => x - y);
  return left.every((value, index) => value === right[index]);
}

function shouldUpdatePhotoUrl(
  existingPhotoUrl: string | null,
  nextPhotoUrl: string | null,
  previousSheetPhotoSource: string | null,
): nextPhotoUrl is string {
  if (!nextPhotoUrl) return false;
  if (!existingPhotoUrl) return true;
  if (existingPhotoUrl === nextPhotoUrl) return false;

  const hasManagedPhoto = existingPhotoUrl.startsWith("/uploads/photos/");
  const sheetPhotoIsExternal = /^(https?:\/\/|data:)/i.test(nextPhotoUrl);

  if (hasManagedPhoto && sheetPhotoIsExternal) {
    return previousSheetPhotoSource !== nextPhotoUrl && previousSheetPhotoSource !== null;
  }

  return true;
}

export async function POST(request: Request) {
  const [, authErr] = await requireEditor(request);
  if (authErr) return authErr;

  let sheetsUrl: string | null = null;
  let dryRun = false;
  try {
    const body = await request.json().catch(() => ({}));
    sheetsUrl = body.url ?? null;
    dryRun = body.dryRun === true;
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

  const csvUrl = toCsvExportUrl(sheetsUrl);

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
  const changes: {
    created: Array<{ name: string; title: string; department: string }>;
    title: Array<{ name: string; before: string; after: string }>;
    status: Array<{ name: string; before: string; after: string }>;
    department: Array<{ name: string; before: string; after: string }>;
    email: Array<{ name: string; before: string | null; after: string | null }>;
    reporting: Array<{ name: string; before: string | null; after: string | null }>;
    secondaryReporting: Array<{ name: string; before: string[]; after: string[] }>;
    photo: Array<{ name: string; before: string | null; after: string | null }>;
    photoPreserved: Array<{ name: string; managedPhoto: string; sheetPhoto: string }>;
    warnings: Array<{ name: string; message: string }>;
  } = {
    created: [],
    title: [],
    status: [],
    department: [],
    email: [],
    reporting: [],
    secondaryReporting: [],
    photo: [],
    photoPreserved: [],
    warnings: [],
  };
  const nameToId = new Map<string, number>();
  const existing = db.select().from(people).all();
  for (const p of existing) nameToId.set(p.name.toLowerCase(), p.id);
  let nextDryRunId = -1;
  const deptRows = db.select().from(departments).all();
  const deptByName = new Map<string, number>();
  const deptNameById = new Map<number, string>();
  for (const d of deptRows) {
    deptNameById.set(d.id, d.name);
    for (const alias of departmentAliases(d.name)) {
      deptByName.set(alias, d.id);
    }
  }
  let nextDeptOrder = deptRows.length;
  let nextDryRunDeptId = -1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.department) {
      results.push({ row: i + 1, name: row.name, status: "error", message: "Missing department" });
      continue;
    }

    // Handle multi-department — use primary
    const deptName = parsePrimaryDepartment(row.department);
    let deptId = deptByName.get(normalizeDepartmentName(deptName));

    // Auto-create department if it doesn't exist
    if (!deptId) {
      const color = pickDeptColor(deptName);
      if (dryRun) {
        deptId = nextDryRunDeptId--;
        deptNameById.set(deptId, deptName);
        nextDeptOrder++;
      } else {
        const inserted = db.insert(departments).values({
          name: deptName,
          color,
          displayOrder: nextDeptOrder++,
        }).returning().get();
        deptId = inserted.id;
        deptNameById.set(deptId, inserted.name);
      }
      for (const alias of departmentAliases(deptName)) {
        deptByName.set(alias, deptId);
      }
    }

    const existingId = nameToId.get(row.name.toLowerCase());
    const photoUrl = row.photo ? normalizePhotoUrl(row.photo) : null;
    const parsedEmail = parseOptionalEmail(row.email);
    const hasInvalidEmail = Boolean(row.email && parsedEmail.error);
    if (hasInvalidEmail) {
      changes.warnings.push({ name: row.name, message: `Invalid email in sheet: ${parsedEmail.error}` });
    }
    const nextEmail = parsedEmail.value;

    if (existingId) {
      const existingPerson = existing.find((p) => p.id === existingId);
      const previousSheetPhotoSource = getSheetPhotoSource(existingPerson?.projectIds ?? null);
      const shouldUpdatePhoto = shouldUpdatePhotoUrl(existingPerson?.photoUrl ?? null, photoUrl, previousSheetPhotoSource);
      const existingManagedPhoto = existingPerson?.photoUrl?.startsWith("/uploads/photos/") ? existingPerson.photoUrl : null;
    if (existingPerson?.title !== row.title) {
      changes.title.push({ name: row.name, before: existingPerson?.title ?? "", after: row.title });
    }
    if (row.hasEmailColumn && !hasInvalidEmail && existingPerson?.email !== nextEmail) {
      changes.email.push({ name: row.name, before: existingPerson?.email ?? null, after: nextEmail ?? null });
    }
      if (existingPerson?.departmentId !== deptId) {
        changes.department.push({
          name: row.name,
          before: deptNameById.get(existingPerson?.departmentId ?? 0) ?? "Unknown",
          after: deptNameById.get(deptId) ?? deptName,
        });
      }
      if (row.isActive !== null && existingPerson?.isActive !== row.isActive) {
        changes.status.push({ name: row.name, before: activeLabel(existingPerson?.isActive), after: activeLabel(row.isActive) });
      }
      if (shouldUpdatePhoto) {
        changes.photo.push({ name: row.name, before: existingPerson?.photoUrl ?? null, after: photoUrl });
      } else if (row.hasPhotoColumn && photoUrl && existingManagedPhoto && photoUrl !== existingManagedPhoto) {
        changes.photoPreserved.push({ name: row.name, managedPhoto: existingManagedPhoto, sheetPhoto: photoUrl });
      }
      const updateProjectIds = row.hasPhotoColumn && photoUrl && (shouldUpdatePhoto || previousSheetPhotoSource)
        ? setSheetPhotoSource(existingPerson?.projectIds ?? null, photoUrl)
        : existingPerson?.projectIds ?? null;
      if (!dryRun) {
        db.update(people).set({
          title: row.title,
          departmentId: deptId,
          ...(row.hasEmailColumn && !hasInvalidEmail && { email: nextEmail }),
          ...(shouldUpdatePhoto && { photoUrl }),
          projectIds: updateProjectIds,
          ...(row.isActive !== null && { isActive: row.isActive }),
          updatedAt: new Date().toISOString(),
        }).where(eq(people.id, existingId)).run();
      }
      results.push({ row: i + 1, name: row.name, status: "updated" });
    } else {
      if (dryRun) {
        nameToId.set(row.name.toLowerCase(), nextDryRunId--);
      } else {
        const inserted = db.insert(people).values({
          name: row.name,
          title: row.title,
          departmentId: deptId,
          photoUrl,
          ...(row.hasEmailColumn && !hasInvalidEmail && { email: nextEmail }),
          projectIds: photoUrl ? setSheetPhotoSource(null, photoUrl) : null,
          isActive: row.isActive ?? true,
        }).returning().get();
        nameToId.set(row.name.toLowerCase(), inserted.id);
      }
      changes.created.push({ name: row.name, title: row.title, department: deptNameById.get(deptId) ?? deptName });
      results.push({ row: i + 1, name: row.name, status: "created" });
    }
  }

  // Second pass: set reports_to hierarchy
  for (const row of rows) {
    const personId = nameToId.get(row.name.toLowerCase());

    if (personId && row.hasReportsToColumn) {
      const person = db.select().from(people).where(eq(people.id, personId)).get();
      const beforeManager = person?.reportsTo
        ? db.select().from(people).where(eq(people.id, person.reportsTo)).get()?.name ?? null
        : null;
      if (row.reportsTo) {
        const managerId = nameToId.get(row.reportsTo.toLowerCase());
        if (managerId && personId !== managerId) {
          if (person?.reportsTo !== managerId) {
            changes.reporting.push({ name: row.name, before: beforeManager, after: row.reportsTo });
          }
          if (!dryRun) {
            db.update(people).set({ reportsTo: managerId }).where(eq(people.id, personId)).run();
          }
        } else if (!managerId) {
          changes.warnings.push({ name: row.name, message: `Reports To manager not found: ${row.reportsTo}` });
        }
      } else {
        if (person?.reportsTo) {
          changes.reporting.push({ name: row.name, before: beforeManager, after: null });
        }
        if (!dryRun) {
          db.update(people).set({ reportsTo: null }).where(eq(people.id, personId)).run();
        }
      }
    }

    if (personId && personId > 0 && row.hasSecondaryReportsToColumn) {
      const person = db.select().from(people).where(eq(people.id, personId)).get();
      const beforeIds = parseSecondaryReportsTo(person?.projectIds ?? null);
      const secondaryReportsTo = splitManagerNames(row.secondaryReportsTo)
        .map((name) => nameToId.get(name.toLowerCase()))
        .filter((id): id is number => typeof id === "number" && id !== personId && id !== person?.reportsTo);
      const missingSecondaryManagers = splitManagerNames(row.secondaryReportsTo)
        .filter((name) => !nameToId.has(name.toLowerCase()));
      for (const name of missingSecondaryManagers) {
        changes.warnings.push({ name: row.name, message: `Secondary Reports To manager not found: ${name}` });
      }
      if (!sameNumberSet(beforeIds, secondaryReportsTo)) {
        changes.secondaryReporting.push({
          name: row.name,
          before: beforeIds.map((id) => db.select().from(people).where(eq(people.id, id)).get()?.name ?? `ID ${id}`),
          after: secondaryReportsTo.map((id) => db.select().from(people).where(eq(people.id, id)).get()?.name ?? `ID ${id}`),
        });
      }

      if (!dryRun) {
        db.update(people)
          .set({ projectIds: setSecondaryReportsTo(person?.projectIds ?? null, secondaryReportsTo) })
          .where(eq(people.id, personId))
          .run();
      }
    }
  }

  // Update last_sync_at
  const now = new Date().toISOString();
  const created = results.filter((r) => r.status === "created").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const errCount = results.filter((r) => r.status === "error").length;
  const syncSummary = {
    timestamp: now,
    summary: { created, updated, errors: errCount, total: rows.length },
    changes,
  };
  if (!dryRun) {
    db.insert(settings)
      .values({ key: "last_sync_at", value: now })
      .onConflictDoUpdate({ target: settings.key, set: { value: now } })
      .run();

    db.insert(settings)
      .values({ key: "last_sync_summary", value: JSON.stringify(syncSummary) })
      .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(syncSummary) } })
      .run();
  }

  return NextResponse.json({
    dryRun,
    results,
    summary: { created, updated, errors: errCount, total: rows.length },
    changes,
  });
}
