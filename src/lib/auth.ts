import { verifyToken, getTokenFromCookieHeader } from "@/lib/session";
import type { AuthUser } from "@/types";

// Server-side: get user from a request (for use in API routes)
export async function getUserFromRequest(request: Request): Promise<AuthUser | null> {
  const cookieHeader = request.headers.get("cookie");
  const token = getTokenFromCookieHeader(cookieHeader);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return { username: payload.username, name: payload.name, role: payload.role };
}
