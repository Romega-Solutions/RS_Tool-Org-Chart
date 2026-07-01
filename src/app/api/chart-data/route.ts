import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { people, departments, settings } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { buildTree } from "@/lib/tree";
import { requireAuth } from "@/lib/auth";
import { settingsRowsToMap } from "@/lib/settings-map";
import type { Department, Person, Setting } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [, err] = await requireAuth(request);
  if (err) return err;
  const allPeople = db
    .select({
      id: people.id,
      name: people.name,
      title: people.title,
      departmentId: people.departmentId,
      reportsTo: people.reportsTo,
      photoUrl: people.photoUrl,
      displayOrder: people.displayOrder,
      isActive: people.isActive,
      createdAt: people.createdAt,
      updatedAt: people.updatedAt,
      employmentType: people.employmentType,
      projectIds: people.projectIds,
    })
    .from(people)
    .where(eq(people.isActive, true))
    .orderBy(asc(people.displayOrder))
    .all() as Array<Omit<Person, "email">>;
  const allDepts = db.select().from(departments).orderBy(asc(departments.displayOrder)).all() as Department[];
  const allSettings = db.select().from(settings).all() as Setting[];
  const tree = buildTree(allPeople, allDepts);
  return NextResponse.json({ tree, departments: allDepts, settings: settingsRowsToMap(allSettings) });
}
