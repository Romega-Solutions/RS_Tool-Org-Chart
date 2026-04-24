import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { getUserFromRequest } from "@/lib/auth";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_EXT = /\.(jpg|jpeg|png|gif|webp)$/i;
const MAX_UPLOAD_DIR_SIZE = 500 * 1024 * 1024; // 500 MB disk quota

// Simple in-memory rate limiter: max 30 uploads per minute per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30;

function checkRateLimit(username: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(username);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(username, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

async function getDirSize(dir: string): Promise<number> {
  try {
    const files = await fs.readdir(dir);
    let total = 0;
    for (const f of files) {
      const stat = await fs.stat(path.join(dir, f));
      if (stat.isFile()) total += stat.size;
    }
    return total;
  } catch {
    return 0;
  }
}

export async function POST(request: Request) {
  // Auth: require editor
  const actor = await getUserFromRequest(request);
  if (!actor || actor.role !== "editor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  if (!checkRateLimit(actor.username)) {
    return NextResponse.json(
      { error: "Too many uploads. Try again in a minute." },
      { status: 429 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXT.test(file.name)) {
    return NextResponse.json(
      { error: "Unsupported file type. Allowed: JPG, PNG, GIF, WebP" },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 400 }
    );
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "photos");
  await fs.mkdir(uploadDir, { recursive: true });

  // Check disk quota
  const currentSize = await getDirSize(uploadDir);
  if (currentSize > MAX_UPLOAD_DIR_SIZE) {
    return NextResponse.json(
      { error: "Storage limit reached. Delete some photos to free space." },
      { status: 507 }
    );
  }

  // Process image
  const buffer = Buffer.from(await file.arrayBuffer());
  let resized: Buffer;
  try {
    resized = await sharp(buffer)
      .resize(200, 200, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { error: "Invalid image file. Could not process." },
      { status: 400 }
    );
  }

  // Strip original extension and use .webp
  const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9.-]/g, "_");
  const filename = `${Date.now()}-${baseName}.webp`;
  await fs.writeFile(path.join(uploadDir, filename), resized);

  return NextResponse.json({ url: `/uploads/photos/${filename}` });
}
