import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/types";

export interface SessionPayload extends Record<string, unknown> {
  username: string;
  name: string;
  role: UserRole;
}

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  console.error(
    "[orgchart] FATAL: SESSION_SECRET is not set. Set it to at least 32 random characters: openssl rand -base64 32"
  );
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("[orgchart] SESSION_SECRET must be set in production");
  }
  return new TextEncoder().encode(
    secret || "orgchart-dev-only-insecure-key-do-not-use-in-prod!!"
  );
}

export const SESSION_COOKIE = "orgchart_token";
export const SESSION_EXPIRY = "7d";

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .sign(getSecretKey());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
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
