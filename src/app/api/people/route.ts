import { NextResponse } from "next/server";
import { db, persistOrgChartDbSnapshot } from "@/lib/db/client";
import { people, departments } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { logChange } from "@/lib/audit";
import { requireEditor, validateString, validateInt, parseOptionalEmail } from "@/lib/auth";

export async function GET(request: Request) {
  const [, err] = await requireEditor(request);
  if (err) return err;

  const { searchParams } = new URL(request.url);
  const includeInactiveRaw = searchParams.get("includeInactive");
  if (includeInactiveRaw && includeInactiveRaw !== "true" && includeInactiveRaw !== "false") {
    return NextResponse.json({ error: "includeInactive must be true or false" }, { status: 400 });
  }
  const includeInactive = includeInactiveRaw === "true";

  const query = db.select({
    id: people.id, name: people.name, title: people.title,
    departmentId: people.departmentId, departmentName: departments.name,
    departmentColor: departments.color, reportsTo: people.reportsTo,
    photoUrl: people.photoUrl, email: people.email, displayOrder: people.displayOrder,
    isActive: people.isActive, createdAt: people.createdAt,
    updatedAt: people.updatedAt, employmentType: people.employmentType,
    projectIds: people.projectIds,
  }).from(people).leftJoin(departments, eq(people.departmentId, departments.id)).orderBy(asc(people.displayOrder));

  const rows = includeInactive ? query.all() : query.where(eq(people.isActive, true)).all();
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const [actor, err] = await requireEditor(request);
  if (err) return err;
  const body = await request.json();
  const { name, title, departmentId, reportsTo, photoUrl, displayOrder, email } = body;

  const nameErr = validateString(name, "Name", 120);
  if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });
  const titleErr = validateString(title, "Title", 160);
  if (titleErr) return NextResponse.json({ error: titleErr }, { status: 400 });

  if (departmentId === undefined || departmentId === null) {
    return NextResponse.json({ error: "departmentId is required" }, { status: 400 });
  }

  const departmentIdNum = typeof departmentId === "number" ? departmentId : Number(departmentId);
  const departmentIdErr = validateInt(departmentIdNum, "Department ID", 1, Number.MAX_SAFE_INTEGER);
  if (departmentIdErr) return NextResponse.json({ error: departmentIdErr }, { status: 400 });

  const emailParsed = parseOptionalEmail(email);
  if (Object.prototype.hasOwnProperty.call(body, "email") && emailParsed.error) {
    return NextResponse.json({ error: emailParsed.error }, { status: 400 });
  }

  const nextReportTo = reportsTo === undefined ? null : (typeof reportsTo === "number" ? reportsTo : Number(reportsTo));
  if (nextReportTo !== null && !Number.isFinite(nextReportTo)) {
    return NextResponse.json({ error: "reportsTo must be a number" }, { status: 400 });
  }
  if (nextReportTo !== null && !Number.isInteger(nextReportTo)) {
    return NextResponse.json({ error: "reportsTo must be an integer" }, { status: 400 });
  }

  const nextDisplayOrder = displayOrder === undefined ? 0 : (typeof displayOrder === "number" ? displayOrder : Number(displayOrder));
  if (!Number.isInteger(nextDisplayOrder)) {
    return NextResponse.json({ error: "displayOrder must be an integer" }, { status: 400 });
  }

  const result = db.insert(people).values({
    name,
    title,
    departmentId: departmentIdNum,
    reportsTo: nextReportTo,
    photoUrl: typeof photoUrl === "string" ? photoUrl : null,
    email: emailParsed.value,
    displayOrder: nextDisplayOrder,
  }).returning().get();
  logChange("created", "person", result.id, result.name, actor.username);
  await persistOrgChartDbSnapshot("people:create");
  return NextResponse.json(result, { status: 201 });
}
