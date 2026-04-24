import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";
import { signToken, SESSION_COOKIE } from "@/lib/session";
import { checkLoginRateLimit, recordLoginFailure, clearLoginFailures, checkCsrf } from "@/lib/auth";
import type { UserRole } from "@/types";

export async function POST(request: Request) {
  const csrfErr = checkCsrf(request);
  if (csrfErr) return csrfErr;

  const { username, password } = await request.json();
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  if (!checkLoginRateLimit(username)) {
    return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }

  const user = db.select().from(users).where(eq(users.username, username.toLowerCase())).get();
  if (!user) {
    recordLoginFailure(username);
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    recordLoginFailure(username);
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  clearLoginFailures(username);
  const token = await signToken({ username: user.username, name: user.name, role: user.role as UserRole });

  const response = NextResponse.json({ username: user.username, name: user.name, role: user.role });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return response;
}
