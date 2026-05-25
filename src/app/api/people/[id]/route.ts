import { NextResponse } from "next/server";
import { db, persistOrgChartDbSnapshot } from "@/lib/db/client";
import { people } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logChange } from "@/lib/audit";
import { requireEditor, parseOptionalEmail, validateString, validateInt } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [, authErr] = await requireEditor(request);
  if (authErr) return authErr;

  const { id } = await params;
  const personId = Number(id);
  if (Number.isNaN(personId)) {
    return NextResponse.json({ error: "Invalid person id" }, { status: 400 });
  }

  const person = db
    .select({
      id: people.id,
      name: people.name,
      title: people.title,
      departmentId: people.departmentId,
      reportsTo: people.reportsTo,
      photoUrl: people.photoUrl,
      email: people.email,
      displayOrder: people.displayOrder,
      isActive: people.isActive,
      employmentType: people.employmentType,
      projectIds: people.projectIds,
    })
    .from(people)
    .where(eq(people.id, personId))
    .get();
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });
  return NextResponse.json(person);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = Number(id);
  if (Number.isNaN(personId)) {
    return NextResponse.json({ error: "Invalid person id" }, { status: 400 });
  }

  const [actor, authErr] = await requireEditor(request);
  if (authErr) return authErr;

  const body = await request.json();
  const { name, title, departmentId, reportsTo, photoUrl, displayOrder, isActive, email } = body;
  const hasReportsTo = Object.prototype.hasOwnProperty.call(body, "reportsTo");
  const hasEmail = Object.prototype.hasOwnProperty.call(body, "email");

  const nextDepartmentId =
    departmentId === undefined || departmentId === null
      ? undefined
      : typeof departmentId === "number"
      ? departmentId
      : Number(departmentId);
  const nextDisplayOrder =
    displayOrder === undefined
      ? undefined
      : typeof displayOrder === "number"
      ? displayOrder
      : Number(displayOrder);
  const nextReportTo =
    !hasReportsTo || reportsTo === undefined
      ? undefined
      : reportsTo === null
      ? null
      : typeof reportsTo === "number"
      ? reportsTo
      : Number(reportsTo);

  if (name !== undefined) {
    const nameErr = validateString(name, "Name", 120);
    if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });
  }
  if (title !== undefined) {
    const titleErr = validateString(title, "Title", 160);
    if (titleErr) return NextResponse.json({ error: titleErr }, { status: 400 });
  }
  if (nextDepartmentId !== undefined) {
    const departmentIdErr = validateInt(nextDepartmentId, "Department ID", 1, Number.MAX_SAFE_INTEGER);
    if (departmentIdErr) return NextResponse.json({ error: departmentIdErr }, { status: 400 });
  }
  if (nextDisplayOrder !== undefined && !Number.isInteger(nextDisplayOrder)) {
    return NextResponse.json({ error: "displayOrder must be an integer" }, { status: 400 });
  }
  if (hasReportsTo && nextReportTo !== null) {
    if (!Number.isFinite(nextReportTo) || !Number.isInteger(nextReportTo)) {
      return NextResponse.json({ error: "reportsTo must be an integer number" }, { status: 400 });
    }
  }
  if (isActive !== undefined && typeof isActive !== "boolean") {
    return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
  }
  const emailParsed = parseOptionalEmail(email);
  if (hasEmail && emailParsed.error) {
    return NextResponse.json({ error: emailParsed.error }, { status: 400 });
  }

  const updateValues = {
    ...(name !== undefined && { name }),
    ...(title !== undefined && { title }),
    ...(nextDepartmentId !== undefined && { departmentId: nextDepartmentId }),
    ...(hasReportsTo && { reportsTo: nextReportTo }),
    ...(photoUrl !== undefined && { photoUrl: typeof photoUrl === "string" ? photoUrl : null }),
    ...(nextDisplayOrder !== undefined && { displayOrder: nextDisplayOrder }),
    ...(isActive !== undefined && { isActive }),
    ...(hasEmail && { email: emailParsed.value }),
    updatedAt: new Date().toISOString(),
  };

  db.update(people).set(updateValues).where(eq(people.id, personId)).run();
  const result = db.select().from(people).where(eq(people.id, personId)).get();
  if (!result) return NextResponse.json({ error: "Person not found" }, { status: 404 });
  logChange("updated", "person", personId, result.name, actor.username, updateValues);
  await persistOrgChartDbSnapshot("people:update");
  return NextResponse.json(result);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = Number(id);
  if (Number.isNaN(personId)) {
    return NextResponse.json({ error: "Invalid person id" }, { status: 400 });
  }

  const [actor, authErr] = await requireEditor(request);
  if (authErr) return authErr;
  const person = db.select().from(people).where(eq(people.id, personId)).get();
  const personName = person?.name ?? `ID ${personId}`;
  db.delete(people).where(eq(people.id, personId)).run();
  logChange("deleted", "person", personId, personName, actor.username);
  await persistOrgChartDbSnapshot("people:delete");
  return NextResponse.json({ success: true });
}
