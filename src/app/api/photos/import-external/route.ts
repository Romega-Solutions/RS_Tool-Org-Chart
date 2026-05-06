import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { logChange } from "@/lib/audit";
import { requireEditor } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { people } from "@/lib/db/schema";
import { fetchExternalPhoto, saveProfilePhoto } from "@/lib/photo-storage";

export const dynamic = "force-dynamic";

type ImportResult = {
  personId: number;
  name: string;
  status: "imported" | "skipped" | "error";
  source?: string;
  photoUrl?: string;
  message?: string;
};

function isLocalManagedPhoto(photoUrl: string) {
  return photoUrl.startsWith("/uploads/photos/");
}

export async function POST(request: Request) {
  const [actor, authErr] = await requireEditor(request);
  if (authErr) return authErr;

  const body = await request.json().catch(() => ({}));
  const personIds = Array.isArray(body.personIds)
    ? new Set(body.personIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id)))
    : null;

  const candidates = db
    .select({ id: people.id, name: people.name, photoUrl: people.photoUrl })
    .from(people)
    .all()
    .filter((person) => {
      if (!person.photoUrl) return false;
      if (personIds && !personIds.has(person.id)) return false;
      return true;
    });

  const results: ImportResult[] = [];

  for (const person of candidates) {
    const source = person.photoUrl;
    if (!source) continue;

    if (isLocalManagedPhoto(source)) {
      results.push({ personId: person.id, name: person.name, status: "skipped", source, message: "Already imported." });
      continue;
    }

    try {
      const buffer = await fetchExternalPhoto(source);
      const photoUrl = await saveProfilePhoto(buffer, person.name);
      db.update(people)
        .set({ photoUrl, updatedAt: new Date().toISOString() })
        .where(eq(people.id, person.id))
        .run();
      logChange("updated", "person", person.id, person.name, actor.username, { photoUrl, importedPhotoFrom: source });
      results.push({ personId: person.id, name: person.name, status: "imported", source, photoUrl });
    } catch (error) {
      results.push({
        personId: person.id,
        name: person.name,
        status: "error",
        source,
        message: error instanceof Error ? error.message : "Could not import photo.",
      });
    }
  }

  return NextResponse.json({
    results,
    summary: {
      imported: results.filter((result) => result.status === "imported").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      errors: results.filter((result) => result.status === "error").length,
      total: results.length,
    },
  });
}
