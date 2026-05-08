import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { requireEditor, getUserFromRequest } from "@/lib/auth";
import { settingsRowsToMap } from "@/lib/settings-map";
import type { Setting } from "@/types";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  const rows = db.select().from(settings).all() as Setting[];
  const map = settingsRowsToMap(rows, user?.role === "editor");

  // Include API key info for authenticated editors only
  if (user?.role === "editor") {
    const apiKey = process.env.API_KEY || "";
    map.api_key = apiKey;
  }

  return NextResponse.json(map);
}

export async function PATCH(request: Request) {
  const [, err] = await requireEditor(request);
  if (err) return err;
  const body: Record<string, string> = await request.json();
  for (const [key, value] of Object.entries(body)) {
    db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
  }
  return NextResponse.json({ success: true });
}
