import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/types";

export interface SessionPayload {
  username: string;
  name: string;
  role: UserRole;
}

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "orgchart-internal-secret-key-2026!!"
);

export const SESSION_COOKIE = "orgchart_token";
export const SESSION_EXPIRY = "7d";

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function getTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}
