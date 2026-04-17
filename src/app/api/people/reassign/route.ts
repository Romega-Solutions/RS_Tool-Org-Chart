import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { people } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logChange } from "@/lib/audit";
import { getUserFromRequest } from "@/lib/auth";

export async function PATCH(request: Request) {
  const body = await request.json();
  const personId = Number(body.personId);
  const reportsTo =
    body.reportsTo === null || body.reportsTo === undefined
      ? null
      : Number(body.reportsTo);

  if (Number.isNaN(personId)) {
    return NextResponse.json({ error: "Invalid person id" }, { status: 400 });
  }

  if (reportsTo !== null && Number.isNaN(reportsTo)) {
    return NextResponse.json(
      { error: "Invalid reportsTo id" },
      { status: 400 }
    );
  }

  const actor = await getUserFromRequest(request);

  const person = db.select().from(people).where(eq(people.id, personId)).get();
  if (!person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  if (reportsTo === personId) {
    return NextResponse.json(
      { error: "A person cannot report to themselves" },
      { status: 400 }
    );
  }

  // When reassigning to a new manager, auto-inherit their department
  let newDepartmentId = person.departmentId;
  if (reportsTo !== null) {
    const manager = db.select().from(people).where(eq(people.id, reportsTo)).get();
    if (manager) {
      newDepartmentId = manager.departmentId;
    }
  }

  const changes: Record<string, unknown> = { reportsTo };
  if (newDepartmentId !== person.departmentId) {
    changes.departmentId = newDepartmentId;
  }

  db
    .update(people)
    .set({
      reportsTo,
      departmentId: newDepartmentId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(people.id, personId))
    .run();

  logChange("updated", "person", personId, person.name, actor?.username ?? null, changes);

  const updated = db.select().from(people).where(eq(people.id, personId)).get();
  return NextResponse.json(updated);
}
