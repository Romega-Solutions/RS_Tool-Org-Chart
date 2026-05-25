import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { people } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { listProfilePhotos } from "@/lib/photo-storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [, err] = await requireAuth(request);
  if (err) return err;

  let managedPhotos: Array<{ filename: string; url: string }> = [];
  try {
    managedPhotos = await listProfilePhotos();
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
  const photos = managedPhotos
    .filter((photo) => IMAGE_EXT.test(photo.filename))
    .map((photo) => ({
      ...photo,
      usedBy: usageMap.get(photo.filename) ?? null,
    }))
    .sort((a, b) => b.filename.localeCompare(a.filename));

  return NextResponse.json(photos);
}
