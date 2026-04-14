import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { people } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

  db
    .update(people)
    .set({
      reportsTo,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(people.id, personId))
    .run();

  const updated = db.select().from(people).where(eq(people.id, personId)).get();
  return NextResponse.json(updated);
}
