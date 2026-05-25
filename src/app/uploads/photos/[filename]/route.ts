import path from "path";
import { NextResponse } from "next/server";
import { contentTypeForPhoto, readProfilePhoto } from "@/lib/photo-storage";

export const dynamic = "force-dynamic";

const ALLOWED_PHOTO_EXTENSIONS = new Set([".gif", ".jpeg", ".jpg", ".png", ".webp"]);

function isSafePhotoFilename(filename: string) {
  return !filename.includes("/") && !filename.includes("\\") && !filename.includes("..");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const ext = path.extname(filename).toLowerCase();

  if (!isSafePhotoFilename(filename) || !ALLOWED_PHOTO_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  try {
    const photo = await readProfilePhoto(filename);
    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(photo.bytes), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": photo.contentType || contentTypeForPhoto(filename),
      },
    });
  } catch {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
}
