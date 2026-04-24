import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { people, departments, settings } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { buildTree } from "@/lib/tree";
import { requireAuth } from "@/lib/auth";
import type { Person, Department } from "@/types";

export async function GET(request: Request) {
  const [, err] = await requireAuth(request);
  if (err) return err;
  const allPeople = db.select().from(people).where(eq(people.isActive, true)).orderBy(asc(people.displayOrder)).all() as Person[];
  const allDepts = db.select().from(departments).orderBy(asc(departments.displayOrder)).all() as Department[];
  const allSettings = db.select().from(settings).all();
  const settingsMap: Record<string, string> = {};
  for (const s of allSettings) settingsMap[s.key] = s.value;
  const tree = buildTree(allPeople, allDepts);
  return NextResponse.json({ tree, departments: allDepts, settings: settingsMap });
}
