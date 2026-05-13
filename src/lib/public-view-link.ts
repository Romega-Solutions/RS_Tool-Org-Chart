import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { APP_BASE_PATH } from "@/lib/paths";

const PUBLIC_CODE_LENGTH = 16;
const PUBLIC_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PUBLIC_LINK_TTL_DAYS = 90;
const DEFAULT_PUBLIC_ORIGIN = "https://tools.romega-solutions.com";

export type PublicViewLink = {
  code: string;
  hash: string;
  expiresAt: string;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function hashPublicViewCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function generatePublicViewCode() {
  let code = "";
  while (code.length < PUBLIC_CODE_LENGTH) {
    const byte = randomBytes(1)[0];
    if (byte >= PUBLIC_CODE_ALPHABET.length * 8) continue;
    code += PUBLIC_CODE_ALPHABET[byte % PUBLIC_CODE_ALPHABET.length];
  }
  return code;
}

export function createPublicViewLink(now = new Date()): PublicViewLink {
  const code = generatePublicViewCode();
  return {
    code,
    hash: hashPublicViewCode(code),
    expiresAt: addDays(now, PUBLIC_LINK_TTL_DAYS).toISOString(),
  };
}

function getSetting(key: string) {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value;
}

function setSetting(key: string, value: string) {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export function savePublicViewLink(link: PublicViewLink) {
  setSetting("public_view_code", link.code);
  setSetting("public_view_code_hash", link.hash);
  setSetting("public_view_expires_at", link.expiresAt);
}

export function ensurePublicViewLink() {
  const code = getSetting("public_view_code");
  const hash = getSetting("public_view_code_hash");
  const expiresAt = getSetting("public_view_expires_at");
  if (code && hash && expiresAt) {
    return { code, hash, expiresAt };
  }

  const link = createPublicViewLink();
  savePublicViewLink(link);
  return link;
}

export function rotatePublicViewLink() {
  const link = createPublicViewLink();
  savePublicViewLink(link);
  return link;
}

export function getPublicViewUrl(origin: string, code: string) {
  const basePath = APP_BASE_PATH && APP_BASE_PATH !== "/" ? APP_BASE_PATH : "";
  return `${origin}${basePath}/view?public=${encodeURIComponent(code)}`;
}

function parseOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function isInternalOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return false;
    if (hostname === "0.0.0.0") return false;
    return !hostname.includes(".");
  } catch {
    return false;
  }
}

export function getPublicRequestOrigin(request: Request) {
  const configuredOrigin =
    parseOrigin(process.env.PUBLIC_APP_ORIGIN) ??
    parseOrigin(process.env.NEXT_PUBLIC_APP_ORIGIN) ??
    parseOrigin(process.env.ORGCHART_BASE_URL);
  if (configuredOrigin) return configuredOrigin;

  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  if (forwardedHost) {
    const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto")) ?? "https";
    return `${forwardedProto}://${forwardedHost}`;
  }

  const requestOrigin = new URL(request.url).origin;
  return isInternalOrigin(requestOrigin) ? DEFAULT_PUBLIC_ORIGIN : requestOrigin;
}

export function isPublicViewCodeValid(code: string | null | undefined) {
  if (!code) return false;

  const hash = getSetting("public_view_code_hash");
  const expiresAt = getSetting("public_view_expires_at");
  if (!hash || !expiresAt) return false;
  if (Number.isNaN(Date.parse(expiresAt)) || new Date(expiresAt).getTime() <= Date.now()) return false;

  const actual = Buffer.from(hashPublicViewCode(code), "hex");
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
