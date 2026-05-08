import { db } from "./client";
import { settings, departments, people, users } from "./schema";
import { count, eq } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import { createPublicViewLink } from "@/lib/public-view-link";

const DEFAULT_PUBLIC_VIEW_LINK = createPublicViewLink();

const DEFAULT_SETTINGS = [
  { key: "org_name", value: "Romega Solutions" },
  { key: "chart_title", value: "ORGANIZATIONAL CHART" },
  { key: "tagline", value: "Where Top Tech Talent Meets Game-Changing Companies" },
  { key: "logo_url", value: "/assets/romega-logo.svg" },
  { key: "primary_color", value: "#0070E0" },
  { key: "accent_color", value: "#C8850A" },
  { key: "neutral_color", value: "#607A99" },
  { key: "support_email", value: "" },
  { key: "sheets_url", value: "https://docs.google.com/spreadsheets/d/161m2rlSDgZbstklDrlXZU87_0isWHJ2o3iLRVNUoW1A/edit?usp=sharing" },
  { key: "last_sync_at", value: "" },
  { key: "public_view_code", value: DEFAULT_PUBLIC_VIEW_LINK.code },
  { key: "public_view_code_hash", value: DEFAULT_PUBLIC_VIEW_LINK.hash },
  { key: "public_view_expires_at", value: DEFAULT_PUBLIC_VIEW_LINK.expiresAt },
];

const DEPARTMENTS = [
  { name: "Executive", color: "#6366f1", displayOrder: 0 },
  { name: "HR/Finance", color: "#ec4899", displayOrder: 1 },
  { name: "Marketing", color: "#f59e0b", displayOrder: 2 },
  { name: "Marketing Intelligence", color: "#8b5cf6", displayOrder: 3 },
  { name: "Sales", color: "#10b981", displayOrder: 4 },
  { name: "Tech", color: "#3b82f6", displayOrder: 5 },
];

// People: [name, title, departmentIndex, reportsToName, displayOrder]
const PEOPLE: [string, string, number, string | null, number][] = [
  // Executive
  ["Robbie Tan", "CEO", 0, null, 0],
  ["Jyrra Mae Tan", "COO", 0, "Robbie Tan", 1],

  // HR/Finance (reports to Jyrra)
  ["Rica Mae Pedemonte", "Executive Assistant", 1, "Robbie Tan", 0],
  ["Eliza Mae F. Perez", "Bookkeeping", 1, "Jyrra Mae Tan", 1],
  ["Erich Belle F. Macabuhay", "Human Resources Business Partner (HRBP) - Onboarding Lead", 1, "Jyrra Mae Tan", 2],
  ["Christine Valencia", "Recruitment Lead", 1, "Jyrra Mae Tan", 3],
  ["Duane Vargas", "AI Lead/Recruiter", 1, "Jyrra Mae Tan", 4],

  // Marketing (reports to Jyrra via Aaron)
  ["Aaron Garcia", "Social Media Coordinator", 2, "Jyrra Mae Tan", 0],
  ["Leighannah Bobis", "Marketing and Brand Content Intern", 2, "Aaron Garcia", 1],
  ["Jorven J. Ledesma", "Marketing and Brand Content Intern", 2, "Aaron Garcia", 2],
  ["Rhenalyn Inot", "Social Media Coordinator", 2, "Aaron Garcia", 3],
  ["Maribeth Alyssa Go", "Marketing and Sales Intern", 2, "Toni Apostol", 4],

  // Marketing Intelligence (reports to Jyrra via Sarah)
  ["Sarah Grace A. Busto", "Market Research Analyst", 3, "Jyrra Mae Tan", 0],
  ["Jillian Andrae P. Tang", "Market Research Analyst Intern", 3, "Sarah Grace A. Busto", 1],

  // Sales (reports to Jyrra via Toni)
  ["Toni Apostol", "Sales Manager", 4, "Jyrra Mae Tan", 0],
  ["Ricardo Salvador", "Account Executive Associate/Sales Trainer", 4, "Toni Apostol", 1],
  ["Mariane De Mesa", "Account Executive Intern", 4, "Toni Apostol", 2],
  ["Kenneth Carrell C. Siapco", "Account Executive Intern", 4, "Toni Apostol", 3],

  // Tech (reports to Jyrra via Mark & Ken)
  ["Mark Angelo Siazon", "Product Designer", 5, "Jyrra Mae Tan", 0],
  ["Ken Patrick Aviñante Garcia", "Full Stack Developer - Web and Mobile", 5, "Jyrra Mae Tan", 1],
  ["Michelle P. Dayday", "Graphics Designer", 5, "Mark Angelo Siazon", 2],
  ["Camyl Richie Gile", "UI/UX Intern", 5, "Mark Angelo Siazon", 3],
  ["Desiree Jipus", "Graphic Design Intern", 5, "Mark Angelo Siazon", 4],
];

const DEFAULT_USERS = [
  { username: "admin", name: "Admin", password: "admin123", role: "editor" as const },
  { username: "editor", name: "Editor", password: "editor123", role: "editor" as const },
  { username: "viewer", name: "Viewer", password: "viewer123", role: "viewer" as const },
  { username: "visitor", name: "Visitor", password: "HelloRomega321", role: "viewer" as const },
];

export function seedSettings() {
  for (const setting of DEFAULT_SETTINGS) {
    db.insert(settings).values(setting).onConflictDoNothing().run();
  }
}

export function seedUsers() {
  for (const u of DEFAULT_USERS) {
    db.insert(users).values({
      username: u.username,
      name: u.name,
      passwordHash: hashSync(u.password, 10),
      role: u.role,
    }).onConflictDoNothing().run();
  }
}

export function seedOrgData() {
  // Only seed if no departments exist (fresh DB)
  const deptCount = db.select({ count: count() }).from(departments).get();
  if (deptCount && deptCount.count > 0) return;

  // Insert departments
  const deptIds: number[] = [];
  for (const dept of DEPARTMENTS) {
    const result = db.insert(departments).values(dept).returning().get();
    deptIds.push(result.id);
  }

  // Insert people (first pass — without reportsTo)
  const nameToId = new Map<string, number>();
  for (const [name, title, deptIdx, , displayOrder] of PEOPLE) {
    const result = db
      .insert(people)
      .values({
        name,
        title,
        departmentId: deptIds[deptIdx],
        displayOrder,
      })
      .returning()
      .get();
    nameToId.set(name, result.id);
  }

  // Second pass — set reportsTo
  for (const [name, , , reportsToName] of PEOPLE) {
    if (reportsToName) {
      const personId = nameToId.get(name);
      const managerId = nameToId.get(reportsToName);
      if (personId && managerId) {
        db.update(people)
          .set({ reportsTo: managerId })
          .where(eq(people.id, personId))
          .run();
      }
    }
  }
}

seedSettings();
seedUsers();
seedOrgData();
