import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getInternalToolsStatus } from "@/lib/automation/tool-status";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [, authErr] = await requireAuth(request);
  if (authErr) return authErr;

  const status = await getInternalToolsStatus(request.url);

  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store, no-cache, max-age=0" },
  });
}
