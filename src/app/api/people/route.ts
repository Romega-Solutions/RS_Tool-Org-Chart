import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { people, departments } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { logChange } from "@/lib/audit";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  const query = db.select({
    id: people.id, name: people.name, title: people.title,
    departmentId: people.departmentId, departmentName: departments.name,
    departmentColor: departments.color, reportsTo: people.reportsTo,
    photoUrl: people.photoUrl, displayOrder: people.displayOrder,
    isActive: people.isActive, createdAt: people.createdAt,
    updatedAt: people.updatedAt, employmentType: people.employmentType,
    projectIds: people.projectIds,
  }).from(people).leftJoin(departments, eq(people.departmentId, departments.id)).orderBy(asc(people.displayOrder));

  const rows = includeInactive ? query.all() : query.where(eq(people.isActive, true)).all();
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const actor = await getUserFromRequest(request);
  const body = await request.json();
  const { name, title, departmentId, reportsTo, photoUrl, displayOrder } = body;
  if (!name || !title || !departmentId) return NextResponse.json({ error: "name, title, and departmentId are required" }, { status: 400 });
  const result = db.insert(people).values({ name, title, departmentId, reportsTo: reportsTo || null, photoUrl: photoUrl || null, displayOrder: displayOrder ?? 0 }).returning().get();
  logChange("created", "person", result.id, result.name, actor?.username ?? null);
  return NextResponse.json(result, { status: 201 });
}
