import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { people } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = Number(id);
  if (Number.isNaN(personId)) {
    return NextResponse.json({ error: "Invalid person id" }, { status: 400 });
  }

  db.delete(people).where(eq(people.id, personId)).run();
  return NextResponse.json({ success: true });
}
