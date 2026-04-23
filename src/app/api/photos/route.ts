import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { db } from "@/lib/db/client";
import { people } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "photos");

  let filenames: string[] = [];
  try {
    filenames = await fs.readdir(uploadDir);
  } catch {
    return NextResponse.json([]);
  }

  const allPeople = db
    .select({ id: people.id, name: people.name, photoUrl: people.photoUrl })
    .from(people)
    .all();

  const usageMap = new Map<string, { id: number; name: string }>();
  for (const person of allPeople) {
    if (person.photoUrl) {
      const filename = person.photoUrl.split("/").pop();
      if (filename) usageMap.set(filename, { id: person.id, name: person.name });
    }
  }

  const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp)$/i;
  const photos = filenames
    .filter((f) => IMAGE_EXT.test(f))
    .map((filename) => ({
      filename,
      url: `/uploads/photos/${filename}`,
      usedBy: usageMap.get(filename) ?? null,
    }))
    .sort((a, b) => b.filename.localeCompare(a.filename));

  return NextResponse.json(photos);
}
