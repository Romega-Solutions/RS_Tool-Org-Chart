import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "orgchart-dev-only-insecure-key-do-not-use-in-prod!!"
);
const SESSION_COOKIE = "orgchart_token";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/org-chart";

function appPath(path: string) {
  if (!BASE_PATH || BASE_PATH === "/") return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

// Global rate limiter: 200 req/min per IP (DDoS mitigation at edge)
const ipCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW = 60_000;
const RATE_MAX = 200;

function rateLimit(request: NextRequest): NextResponse | null {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  const now = Date.now();
  const entry = ipCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return null;
  }

  entry.count++;
  if (entry.count > RATE_MAX) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }
  return null;
}

// Clean stale entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipCounts) {
    if (now > entry.resetAt) ipCounts.delete(ip);
  }
}, 5 * 60_000);

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip rate limiting for auth endpoints (they have their own brute-force protection)
  // and for Next.js internals / static assets
  if (!path.startsWith("/api/auth/") && !path.startsWith("/_next/")) {
    const rateLimitResponse = rateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;
  }

  // API routes handle their own auth — only rate limit them here
  if (path.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Page routes: require valid session cookie
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    const loginUrl = new URL(appPath("/login"), request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    await jwtVerify(token, SECRET_KEY);
    return NextResponse.next();
  } catch {
    const loginUrl = new URL(appPath("/login"), request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/chart/:path*", "/admin/:path*", "/account/:path*", "/api/:path*"],
};
