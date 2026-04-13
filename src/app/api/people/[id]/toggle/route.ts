import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { people } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = Number(id);
  if (Number.isNaN(personId)) {
    return NextResponse.json({ error: "Invalid person id" }, { status: 400 });
  }

  const person = db.select().from(people).where(eq(people.id, personId)).get();
  if (!person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  db
    .update(people)
    .set({ isActive: !person.isActive, updatedAt: new Date().toISOString() })
    .where(eq(people.id, personId))
    .run();

  const updated = db.select().from(people).where(eq(people.id, personId)).get();
  return NextResponse.json(updated);
}
