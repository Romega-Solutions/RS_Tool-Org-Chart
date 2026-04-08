import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { people } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = db.select().from(people).where(eq(people.id, Number(id))).get();
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });
  return NextResponse.json(person);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, title, departmentId, reportsTo, photoUrl, displayOrder } = body;
  const result = db.update(people).set({
    ...(name !== undefined && { name }),
    ...(title !== undefined && { title }),
    ...(departmentId !== undefined && { departmentId }),
    ...(reportsTo !== undefined && { reportsTo }),
    ...(photoUrl !== undefined && { photoUrl }),
    ...(displayOrder !== undefined && { displayOrder }),
    updatedAt: new Date().toISOString(),
  }).where(eq(people.id, Number(id))).returning().get();
  if (!result) return NextResponse.json({ error: "Person not found" }, { status: 404 });
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.delete(people).where(eq(people.id, Number(id))).run();
  return NextResponse.json({ success: true });
}
