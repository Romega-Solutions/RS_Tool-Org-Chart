import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { people } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logChange } from "@/lib/audit";
import { requireEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = Number(id);
  if (Number.isNaN(personId)) {
    return NextResponse.json({ error: "Invalid person id" }, { status: 400 });
  }

  const person = db.select().from(people).where(eq(people.id, personId)).get();
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
  const { name, title, departmentId, reportsTo, photoUrl, displayOrder, isActive } = body;
  const updateValues = {
    ...(name !== undefined && { name }),
    ...(title !== undefined && { title }),
    ...(departmentId !== undefined && { departmentId }),
    ...(reportsTo !== undefined && { reportsTo }),
    ...(photoUrl !== undefined && { photoUrl }),
    ...(displayOrder !== undefined && { displayOrder }),
    ...(isActive !== undefined && { isActive }),
    updatedAt: new Date().toISOString(),
  };

  db.update(people).set(updateValues).where(eq(people.id, personId)).run();
  const result = db.select().from(people).where(eq(people.id, personId)).get();
  if (!result) return NextResponse.json({ error: "Person not found" }, { status: 404 });
  logChange("updated", "person", personId, result.name, actor.username, updateValues);
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
  return NextResponse.json({ success: true });
}
