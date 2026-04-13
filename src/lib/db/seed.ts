import { db } from "./client";
import { settings, departments, people } from "./schema";
import { count, eq } from "drizzle-orm";

const DEFAULT_SETTINGS = [
  { key: "org_name", value: "Romega Solutions" },
  { key: "chart_title", value: "ORGANIZATIONAL CHART" },
  { key: "tagline", value: "Where Top Tech Talent Meets Game-Changing Companies" },
  { key: "logo_url", value: "/assets/romega-logo.svg" },
  { key: "primary_color", value: "#0070E0" },
  { key: "accent_color", value: "#C8850A" },
  { key: "neutral_color", value: "#607A99" },
];

const DEPARTMENTS = [
  { name: "Executive", color: "#1a5276", displayOrder: 0 },
  { name: "Market Intelligence", color: "#2e86c1", displayOrder: 1 },
  { name: "Technical", color: "#148f77", displayOrder: 2 },
  { name: "Recruitment & Onboarding", color: "#6c3483", displayOrder: 3 },
  { name: "Marketing", color: "#d68910", displayOrder: 4 },
  { name: "Sales", color: "#cb4335", displayOrder: 5 },
];

// People: [name, title, departmentIndex, reportsToName, displayOrder]
const PEOPLE: [string, string, number, string | null, number][] = [
  // Executive
  ["Robbie Galoso", "Founder", 0, null, 0],
  ["Cherry Ann Reyes", "Chief of Staff", 0, "Robbie Galoso", 1],
  ["Eliza Mae Perez", "Bookkeeper", 0, "Robbie Galoso", 2],
  ["Ryce Daniotvniex", "Virtual Assistant", 0, "Robbie Galoso", 3],
  ["Jyrra Arcales", "Project Manager", 0, "Robbie Galoso", 4],

  // Market Intelligence (reports to Cherry Ann)
  ["Ro Ann Rivero", "Market Analyst Intern", 1, "Cherry Ann Reyes", 0],
  ["Edmayelle Alforia", "Market Analyst Intern", 1, "Cherry Ann Reyes", 1],
  ["Sarah Busto", "Market Analyst Intern", 1, "Cherry Ann Reyes", 2],
  ["Jill San Luis", "Market Analyst Intern", 1, "Cherry Ann Reyes", 3],

  // Technical (reports to Robbie)
  ["Mark Siazon", "Product Designer", 2, "Robbie Galoso", 0],
  ["Ken Garcia", "Full Stack Developer", 2, "Robbie Galoso", 1],
  ["Mich Dayday", "Graphic Designer", 2, "Robbie Galoso", 2],

  // Recruitment & Onboarding (reports to Jyrra)
  ["Christine Valencia", "Sourcing Lead", 3, "Jyrra Arcales", 0],
  ["Duane Vargas", "HR Business Partner", 3, "Jyrra Arcales", 1],
  ["Erich Macabuhay", "HR Intern", 3, "Jyrra Arcales", 2],
  ["Lyle Paraboles", "HR Intern", 3, "Jyrra Arcales", 3],

  // Marketing (reports to Jyrra)
  ["Audrey Maureen Molina", "Marketing Lead", 4, "Jyrra Arcales", 0],
  ["Mickey Co", "Marketing Intern", 4, "Audrey Maureen Molina", 1],
  ["Jillian Tang", "Marketing Intern", 4, "Audrey Maureen Molina", 2],
  ["Deikna Anay", "Marketing Intern", 4, "Audrey Maureen Molina", 3],

  // Sales (reports to Jyrra)
  ["Rich Salvador", "Account Executive", 5, "Jyrra Arcales", 0],
  ["Mafi Labucuas", "Account Executive Intern", 5, "Rich Salvador", 1],
  ["Jayber Lingogon", "Account Executive Intern", 5, "Rich Salvador", 2],
  ["Kailynne Lee", "Account Executive Intern", 5, "Rich Salvador", 3],
  ["Mari Mirabueno", "Account Executive Intern", 5, "Rich Salvador", 4],
  ["Ryied Bose", "Account Executive Intern", 5, "Rich Salvador", 5],
];

export function seedSettings() {
  for (const setting of DEFAULT_SETTINGS) {
    db.insert(settings).values(setting).onConflictDoNothing().run();
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
seedOrgData();
