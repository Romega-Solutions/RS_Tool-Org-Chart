import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { verifyToken, getTokenFromCookieHeader } from "@/lib/session";
import type { AuthUser } from "@/types";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function getIntegrationApiKeys(): string[] {
  return [process.env.API_KEY, process.env.ORGCHART_API_KEY]
    .map((key) => key?.trim())
    .filter((key): key is string => Boolean(key));
}

function hasValidApiKey(request: Request): boolean {
  const apiKey = request.headers.get("x-api-key")?.trim();
  if (!apiKey) return false;

  return getIntegrationApiKeys().some((expected) => safeCompare(apiKey, expected));
}

// CSRF: verify Origin header for mutating requests when present.
// SameSite=lax cookies already prevent most CSRF. This adds defense-in-depth
// by rejecting requests with a mismatched Origin header (cross-site POST).
export function checkCsrf(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  // Valid API key requests are exempt (machine-to-machine)
  if (hasValidApiKey(request)) return null;

  // Only check if Origin is present — browsers always send it for cross-origin requests.
  // Same-origin requests may omit it (e.g., fetch without mode: "cors"), which is fine
  // since SameSite=lax cookies protect those.
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("host") || "localhost:3000";
    const allowed = [`http://${host}`, `https://${host}`];
    if (!allowed.includes(origin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return null;
}

// Server-side: get user from a request (for use in API routes)
// Supports both session cookies and X-API-Key header for external systems (n8n, AI agents)
export async function getUserFromRequest(request: Request): Promise<AuthUser | null> {
  // 1. Check X-API-Key header (for n8n / external integrations)
  if (hasValidApiKey(request)) {
    return { username: "api", name: "API Integration", role: "editor" };
  }

  // 2. Fall back to session cookie
  const cookieHeader = request.headers.get("cookie");
  const token = getTokenFromCookieHeader(cookieHeader);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return { username: payload.username, name: payload.name, role: payload.role };
}

// Require authentication — returns [user, null] on success or [null, Response] on failure.
// Usage: const [actor, err] = await requireAuth(request); if (err) return err;
export async function requireAuth(request: Request): Promise<[AuthUser, null] | [null, NextResponse]> {
  const user = await getUserFromRequest(request);
  if (!user) {
    return [null, NextResponse.json({ error: "Unauthorized" }, { status: 401 })];
  }
  return [user, null];
}

// Require editor role — returns 401 if unauthenticated, 403 if wrong role or CSRF failure.
export async function requireEditor(request: Request): Promise<[AuthUser, null] | [null, NextResponse]> {
  const csrfErr = checkCsrf(request);
  if (csrfErr) return [null, csrfErr];

  const user = await getUserFromRequest(request);
  if (!user) {
    return [null, NextResponse.json({ error: "Unauthorized" }, { status: 401 })];
  }
  if (user.role !== "editor") {
    return [null, NextResponse.json({ error: "Forbidden" }, { status: 403 })];
  }
  return [user, null];
}

// Login rate limiter: max 10 FAILED attempts per 15 minutes per username
const loginFailures = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW = 15 * 60_000;
const LOGIN_MAX_FAILURES = 10;

export function checkLoginRateLimit(username: string): boolean {
  const now = Date.now();
  const key = username.toLowerCase();
  const entry = loginFailures.get(key);
  if (!entry || now > entry.resetAt) return true;
  return entry.count < LOGIN_MAX_FAILURES;
}

export function recordLoginFailure(username: string): void {
  const now = Date.now();
  const key = username.toLowerCase();
  const entry = loginFailures.get(key);
  if (!entry || now > entry.resetAt) {
    loginFailures.set(key, { count: 1, resetAt: now + LOGIN_WINDOW });
  } else {
    entry.count++;
  }
}

export function clearLoginFailures(username: string): void {
  loginFailures.delete(username.toLowerCase());
}

// --- Global request rate limiter (DDoS mitigation) ---
// 200 requests per minute per IP
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const GLOBAL_WINDOW = 60_000;
const GLOBAL_MAX = 200;

export function checkGlobalRateLimit(request: Request): NextResponse | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + GLOBAL_WINDOW });
    return null;
  }

  entry.count++;
  if (entry.count > GLOBAL_MAX) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  return null;
}

// --- Input validators ---
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function validateColor(color: unknown): string | null {
  if (color === null || color === undefined || color === "") return null;
  if (typeof color !== "string" || !HEX_COLOR.test(color)) return "Invalid color format (use #RRGGBB)";
  return null;
}

export function validateString(value: unknown, field: string, maxLen = 200): string | null {
  if (typeof value !== "string") return `${field} must be a string`;
  if (value.trim().length === 0) return `${field} is required`;
  if (value.length > maxLen) return `${field} must be under ${maxLen} characters`;
  return null;
}

export function validateInt(value: unknown, field: string, min = 0, max = 10000): string | null {
  if (value === undefined || value === null) return null; // optional
  if (typeof value !== "number" || !Number.isInteger(value)) return `${field} must be an integer`;
  if (value < min || value > max) return `${field} must be between ${min} and ${max}`;
  return null;
}
