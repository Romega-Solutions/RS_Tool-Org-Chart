import { NextResponse } from "next/server";
import { db, persistOrgChartDbSnapshot } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { compare, hashSync } from "bcryptjs";
import { requireAuth, checkCsrf } from "@/lib/auth";
import { logChange } from "@/lib/audit";

export async function POST(request: Request) {
  const csrfErr = checkCsrf(request);
  if (csrfErr) return csrfErr;

  const [actor, authErr] = await requireAuth(request);
  if (authErr) return authErr;

  const body = await request.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required" }, { status: 400 });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  if (newPassword.length > 128) {
    return NextResponse.json({ error: "Password too long" }, { status: 400 });
  }

  const user = db.select().from(users).where(eq(users.username, actor.username)).get();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const valid = await compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const newHash = hashSync(newPassword, 10);
  db.update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, user.id))
    .run();

  logChange("updated", "person", user.id, user.name, actor.username, { passwordChanged: true });
  await persistOrgChartDbSnapshot("auth:change-password");

  return NextResponse.json({ success: true });
}
