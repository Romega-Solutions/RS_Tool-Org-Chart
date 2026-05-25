import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { people } from "@/lib/db/schema";
import { deleteProfilePhoto, listProfilePhotos } from "@/lib/photo-storage";

export const dynamic = "force-dynamic";

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp)$/i;

export async function POST(request: Request) {
  const [, authErr] = await requireEditor(request);
  if (authErr) return authErr;

  let managedPhotos: Array<{ filename: string }> = [];
  try {
    managedPhotos = await listProfilePhotos();
  } catch {
    return NextResponse.json({ deleted: 0, failed: [], totalUnused: 0 });
  }

  const usedFilenames = new Set<string>();
  const allPeople = db.select({ photoUrl: people.photoUrl }).from(people).all();
  for (const person of allPeople) {
    if (!person.photoUrl?.startsWith("/uploads/photos/")) continue;
    const filename = person.photoUrl.split("/").pop();
    if (filename) usedFilenames.add(filename);
  }

  const unused = managedPhotos
    .map((photo) => photo.filename)
    .filter((filename) => IMAGE_EXT.test(filename) && !usedFilenames.has(filename));
  const failed: string[] = [];
  let deleted = 0;

  for (const filename of unused) {
    try {
      const didDelete = await deleteProfilePhoto(filename);
      if (didDelete) deleted++;
      else failed.push(filename);
    } catch {
      failed.push(filename);
    }
  }

  return NextResponse.json({
    deleted,
    failed,
    totalUnused: unused.length,
  });
}
