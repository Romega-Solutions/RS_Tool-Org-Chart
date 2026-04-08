import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";

export async function GET() {
  const rows = db.select().from(settings).all();
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return NextResponse.json(map);
}

export async function PATCH(request: Request) {
  const body: Record<string, string> = await request.json();
  for (const [key, value] of Object.entries(body)) {
    db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
  }
  return NextResponse.json({ success: true });
}
