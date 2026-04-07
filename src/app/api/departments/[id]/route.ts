import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { departments, people } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, color, displayOrder } = body;
  const result = db.update(departments).set({
    ...(name !== undefined && { name }),
    ...(color !== undefined && { color }),
    ...(displayOrder !== undefined && { displayOrder }),
    updatedAt: new Date().toISOString(),
  }).where(eq(departments.id, Number(id))).returning().get();
  if (!result) return NextResponse.json({ error: "Department not found" }, { status: 404 });
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deptId = Number(id);
  const memberCount = db.select({ count: count() }).from(people).where(eq(people.departmentId, deptId)).get();
  if (memberCount && memberCount.count > 0) {
    return NextResponse.json({ error: `Cannot delete: ${memberCount.count} people are assigned. Reassign them first.` }, { status: 409 });
  }
  db.delete(departments).where(eq(departments.id, deptId)).run();
  return NextResponse.json({ success: true });
}
