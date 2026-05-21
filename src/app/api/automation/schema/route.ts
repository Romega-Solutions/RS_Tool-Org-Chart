import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { orgChartAutomationSchema } from "@/lib/automation/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [, authErr] = await requireAuth(request);
  if (authErr) return authErr;

  return NextResponse.json(orgChartAutomationSchema, {
    headers: { "Cache-Control": "no-store, no-cache, max-age=0" },
  });
}
