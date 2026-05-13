import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

export const MAX_PHOTO_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_UPLOAD_DIR_SIZE = 500 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
export const ALLOWED_PHOTO_EXT = /\.(jpg|jpeg|png|gif|webp)$/i;
export const EXTERNAL_PHOTO_FETCH_TIMEOUT_MS = 4_000;

export function getPhotoUploadDir() {
  return path.join(process.cwd(), "public", "uploads", "photos");
}

export async function getDirSize(dir: string): Promise<number> {
  try {
    const files = await fs.readdir(dir);
    let total = 0;
    for (const file of files) {
      const stat = await fs.stat(path.join(dir, file));
      if (stat.isFile()) total += stat.size;
    }
    return total;
  } catch {
    return 0;
  }
}

function safeBaseName(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "photo";
}

export async function saveProfilePhoto(buffer: Buffer, baseName: string) {
  const uploadDir = getPhotoUploadDir();
  await fs.mkdir(uploadDir, { recursive: true });

  const currentSize = await getDirSize(uploadDir);
  if (currentSize > MAX_UPLOAD_DIR_SIZE) {
    throw new Error("Storage limit reached. Delete some photos to free space.");
  }

  const resized = await sharp(buffer)
    .resize(200, 200, { fit: "cover" })
    .webp({ quality: 80 })
    .toBuffer();

  const filename = `${Date.now()}-${safeBaseName(baseName)}.webp`;
  await fs.writeFile(path.join(uploadDir, filename), resized);

  return `/uploads/photos/${filename}`;
}

export function normalizeDrivePhotoUrl(raw: string) {
  const trimmed = raw.trim();
  const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  }

  const openMatch = trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) {
    return `https://drive.google.com/uc?export=view&id=${openMatch[1]}`;
  }

  return trimmed;
}

export async function fetchExternalPhoto(rawUrl: string, timeoutMs = EXTERNAL_PHOTO_FETCH_TIMEOUT_MS) {
  const url = normalizeDrivePhotoUrl(rawUrl);

  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
    if (!match) throw new Error("Invalid data URL.");
    const isBase64 = Boolean(match[2]);
    const body = decodeURIComponent(match[3] ?? "");
    const buffer = isBase64 ? Buffer.from(body, "base64") : Buffer.from(body);
    if (buffer.byteLength > MAX_PHOTO_FILE_SIZE) throw new Error("File too large.");
    return buffer;
  }

  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Photo URL must be an HTTP, HTTPS, Google Drive, or data URL.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, { redirect: "follow", signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Photo fetch timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(`Photo fetch failed with HTTP ${response.status}.`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PHOTO_FILE_SIZE) throw new Error("File too large.");

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_PHOTO_FILE_SIZE) throw new Error("File too large.");
  return buffer;
}
