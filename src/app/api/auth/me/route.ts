import { NextResponse } from "next/server";
import { verifyToken, getTokenFromCookieHeader } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const token = getTokenFromCookieHeader(cookieHeader);
  if (!token) return NextResponse.json(null);
  const user = await verifyToken(token);
  if (!user) return NextResponse.json(null);
  return NextResponse.json({ username: user.username, name: user.name, role: user.role });
}
