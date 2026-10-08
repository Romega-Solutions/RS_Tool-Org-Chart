import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { loadDirectoryChart } from "@/lib/directory";
import { settingsRowsToMap } from "@/lib/settings-map";
import type { Setting } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [, err] = await requireAuth(request);
  if (err) return err;
  const { tree, departments } = await loadDirectoryChart();
  const allSettings = db.select().from(settings).all() as Setting[];
  return NextResponse.json({ tree, departments, settings: settingsRowsToMap(allSettings) });
}
