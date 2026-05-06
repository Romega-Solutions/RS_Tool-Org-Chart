import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getPhotoUploadDir } from "@/lib/photo-storage";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function isSafePhotoFilename(filename: string) {
  return !filename.includes("/") && !filename.includes("\\") && !filename.includes("..");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const ext = path.extname(filename).toLowerCase();

  if (!isSafePhotoFilename(filename) || !CONTENT_TYPES[ext]) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(getPhotoUploadDir(), filename);

  try {
    const file = await fs.readFile(filePath);
    return new NextResponse(file, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": CONTENT_TYPES[ext],
      },
    });
  } catch {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
}
