import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import {
  ALLOWED_PHOTO_EXT,
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_FILE_SIZE,
  saveProfilePhoto,
} from "@/lib/photo-storage";

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
  if (!ALLOWED_PHOTO_TYPES.includes(file.type) && !ALLOWED_PHOTO_EXT.test(file.name)) {
    return NextResponse.json(
      { error: "Unsupported file type. Allowed: JPG, PNG, GIF, WebP" },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_PHOTO_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_PHOTO_FILE_SIZE / 1024 / 1024}MB` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const url = await saveProfilePhoto(buffer, file.name);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid image file. Could not process.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Storage") ? 507 : 400 });
  }
}
