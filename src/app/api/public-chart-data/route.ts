import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { loadDirectoryChart } from "@/lib/directory";
import { isPublicViewCodeValid } from "@/lib/public-view-link";
import { settingsRowsToMap } from "@/lib/settings-map";
import type { Setting } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!isPublicViewCodeValid(code)) {
    return NextResponse.json({ error: "Public view link is invalid or expired" }, { status: 403 });
  }

  const { tree, departments } = await loadDirectoryChart();
  const allSettings = db.select().from(settings).all() as Setting[];
  return NextResponse.json({ tree, departments, settings: settingsRowsToMap(allSettings) });
}
