import postgres from "postgres";
import { buildTree } from "@/lib/tree";
import type { StaffProfile } from "@/lib/automation/schema";
import type { Department, Person, TreeNode } from "@/types";

// Read-only access to the Employee Portal's `directory` schema. The portal is the
// source of truth for people, departments, reporting lines and photos; this app
// never writes to it. See the portal repo's docs/migrations/add-directory-reader.sql.

const globalForDirectory = globalThis as unknown as { directorySql?: postgres.Sql };

function getSql() {
  if (globalForDirectory.directorySql) return globalForDirectory.directorySql;

  const url = process.env.DIRECTORY_DATABASE_URL;
  if (!url) throw new Error("DIRECTORY_DATABASE_URL is not set");

  // Supabase pooler in transaction mode does not support prepared statements.
  const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 15 });
  globalForDirectory.directorySql = sql;
  return sql;
}

/** Public base URL of the portal's Supabase project, e.g. https://<ref>.supabase.co */
function getSupabaseUrl() {
  const explicit = process.env.DIRECTORY_SUPABASE_URL;
  if (explicit) return explicit.endsWith("/") ? explicit.slice(0, -1) : explicit;

  // The pooler username is `directory_reader.<project-ref>`.
  const url = process.env.DIRECTORY_DATABASE_URL;
  if (!url) return null;
  try {
    const ref = decodeURIComponent(new URL(url).username).split(".")[1];
    return ref ? `https://${ref}.supabase.co` : null;
  } catch {
    return null;
  }
}

function photoUrlFor(photoPath: string | null) {
  if (!photoPath) return null;
  const base = getSupabaseUrl();
  if (!base) return null;
  const key = photoPath.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/user-photos/${key}`;
}

interface DirectoryPersonRow {
  id: number;
  name: string;
  job_title: string | null;
  department: string | null;
  reports_to_user_id: number | null;
  photo_path: string | null;
  display_order: number | null;
}

interface DirectoryDepartmentRow {
  name: string;
  color: string | null;
  display_order: number | null;
}

interface DirectorySecondaryLeadRow {
  user_id: number;
  also_reports_to_user_id: number;
}

export interface DirectoryChart {
  tree: TreeNode[];
  departments: Department[];
}

const UNASSIGNED_DEPARTMENT = "Unassigned";

// Departments have no id in the portal, so number them by display order.
function numberDepartments(rows: DirectoryDepartmentRow[]): Department[] {
  const sorted = [...rows].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name),
  );
  return sorted.map((d, index) => ({
    id: index + 1,
    name: d.name,
    color: d.color,
    displayOrder: d.display_order ?? index,
  }));
}

/** Flat staff list for other internal tools (Certificate Creator, Email Signature via n8n). */
export async function loadStaffProfiles(includeInactive: boolean): Promise<StaffProfile[]> {
  const sql = getSql();
  const [peopleRows, departmentRows] = await Promise.all([
    sql<Array<DirectoryPersonRow & { email: string | null; is_active: boolean }>>`
      select id, name, email, job_title, department, reports_to_user_id, is_active, display_order
      from directory.people
      where not is_hidden and (${includeInactive} or is_active)
      order by display_order, name
    `,
    sql<DirectoryDepartmentRow[]>`
      select name, color, display_order from directory.departments
    `,
  ]);
  const departmentIdByName = new Map(numberDepartments(departmentRows).map((d) => [d.name, d.id]));

  return peopleRows.map((p) => ({
    id: p.id,
    name: p.name,
    title: p.job_title ?? "",
    email: p.email,
    departmentId: departmentIdByName.get(p.department ?? "") ?? null,
    departmentName: p.department && departmentIdByName.has(p.department) ? p.department : null,
    managerId: p.reports_to_user_id,
    isActive: p.is_active,
  }));
}

export async function loadDirectoryChart(): Promise<DirectoryChart> {
  const sql = getSql();
  const [peopleRows, departmentRows, secondaryRows] = await Promise.all([
    sql<DirectoryPersonRow[]>`
      select id, name, job_title, department, reports_to_user_id, photo_path, display_order
      from directory.people
      where is_active and not is_hidden
    `,
    sql<DirectoryDepartmentRow[]>`
      select name, color, display_order from directory.departments
    `,
    sql<DirectorySecondaryLeadRow[]>`
      select user_id, also_reports_to_user_id from directory.secondary_leads
    `,
  ]);

  const departments = numberDepartments(departmentRows);
  const departmentIdByName = new Map(departments.map((d) => [d.name, d.id]));

  // People without a department (or with one the portal no longer lists) still need a group.
  if (peopleRows.some((p) => !p.department || !departmentIdByName.has(p.department))) {
    const unassigned: Department = {
      id: departments.length + 1,
      name: UNASSIGNED_DEPARTMENT,
      color: null,
      displayOrder: Number.MAX_SAFE_INTEGER,
    };
    departments.push(unassigned);
    departmentIdByName.set(UNASSIGNED_DEPARTMENT, unassigned.id);
  }

  const visibleIds = new Set(peopleRows.map((p) => p.id));
  const root = peopleRows.find((p) => p.reports_to_user_id === null);

  const people: Person[] = peopleRows.map((p) => {
    let reportsTo = p.reports_to_user_id;
    // A lead who is inactive or hidden would orphan their reports; attach them to the root.
    if (reportsTo !== null && !visibleIds.has(reportsTo)) reportsTo = root ? root.id : null;

    return {
      id: p.id,
      name: p.name,
      title: p.job_title ?? "",
      departmentId: departmentIdByName.get(p.department ?? "") ?? departmentIdByName.get(UNASSIGNED_DEPARTMENT)!,
      reportsTo,
      photoUrl: photoUrlFor(p.photo_path),
      displayOrder: p.display_order ?? 0,
      isActive: true,
    };
  });

  const secondaryByPerson = new Map<number, number[]>();
  for (const row of secondaryRows) {
    if (!visibleIds.has(row.user_id) || !visibleIds.has(row.also_reports_to_user_id)) continue;
    const list = secondaryByPerson.get(row.user_id) ?? [];
    list.push(row.also_reports_to_user_id);
    secondaryByPerson.set(row.user_id, list);
  }

  return { tree: buildTree(people, departments, secondaryByPerson), departments };
}
