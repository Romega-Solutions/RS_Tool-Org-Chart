import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { db } from "@/lib/db/client";
import { people } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logChange } from "@/lib/audit";
import { getUserFromRequest } from "@/lib/auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (filename.includes("/") || filename.includes("..") || filename.includes("\\")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const actor = await getUserFromRequest(request);
  const photoUrl = `/uploads/photos/${filename}`;
  const filePath = path.join(process.cwd(), "public", "uploads", "photos", filename);

  const affectedPeople = db
    .select({ id: people.id, name: people.name })
    .from(people)
    .where(eq(people.photoUrl, photoUrl))
    .all();

  for (const person of affectedPeople) {
    db.update(people)
      .set({ photoUrl: null, updatedAt: new Date().toISOString() })
      .where(eq(people.id, person.id))
      .run();
    logChange("updated", "person", person.id, person.name, actor?.username ?? null, { photoUrl: null });
  }

  try {
    await fs.unlink(filePath);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, cleared: affectedPeople.length });
}
