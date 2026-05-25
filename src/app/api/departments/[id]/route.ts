import { NextResponse } from "next/server";
import { db, persistOrgChartDbSnapshot } from "@/lib/db/client";
import { departments, people } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { logChange } from "@/lib/audit";
import { requireEditor, validateString, validateColor, validateInt } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deptId = Number(id);
  if (Number.isNaN(deptId)) return NextResponse.json({ error: "Invalid department id" }, { status: 400 });

  const [actor, err] = await requireEditor(request);
  if (err) return err;
  const body = await request.json();
  const { name, color, displayOrder } = body;

  if (name !== undefined) {
    const nameErr = validateString(name, "Name", 100);
    if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });
  }
  const colorErr = validateColor(color);
  if (colorErr) return NextResponse.json({ error: colorErr }, { status: 400 });
  const orderErr = validateInt(displayOrder, "Display order");
  if (orderErr) return NextResponse.json({ error: orderErr }, { status: 400 });

  const result = db.update(departments).set({
    ...(name !== undefined && { name }),
    ...(color !== undefined && { color }),
    ...(displayOrder !== undefined && { displayOrder }),
    updatedAt: new Date().toISOString(),
  }).where(eq(departments.id, deptId)).returning().get();
  if (!result) return NextResponse.json({ error: "Department not found" }, { status: 404 });
  logChange("updated", "department", result.id, result.name, actor.username, { name, color, displayOrder });
  await persistOrgChartDbSnapshot("departments:update");
  return NextResponse.json(result);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deptId = Number(id);
  if (Number.isNaN(deptId)) return NextResponse.json({ error: "Invalid department id" }, { status: 400 });
  const [actor, authErr] = await requireEditor(request);
  if (authErr) return authErr;
  const memberCount = db.select({ count: count() }).from(people).where(eq(people.departmentId, deptId)).get();
  if (memberCount && memberCount.count > 0) {
    return NextResponse.json({ error: `Cannot delete: ${memberCount.count} people are assigned. Reassign them first.` }, { status: 409 });
  }
  const dept = db.select().from(departments).where(eq(departments.id, deptId)).get();
  const deptName = dept?.name ?? `ID ${deptId}`;
  db.delete(departments).where(eq(departments.id, deptId)).run();
  logChange("deleted", "department", deptId, deptName, actor.username);
  await persistOrgChartDbSnapshot("departments:delete");
  return NextResponse.json({ success: true });
}
