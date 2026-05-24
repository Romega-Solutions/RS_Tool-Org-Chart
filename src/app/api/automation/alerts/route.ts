import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  appendAutomationAlert,
  normalizeAutomationAlert,
  readAutomationAlerts,
  type AutomationAlertInput,
} from "@/lib/automation/alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const [, authErr] = await requireAuth(request);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 20;

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return NextResponse.json({ error: "limit must be an integer between 1 and 100" }, { status: 400 });
  }

  const alerts = await readAutomationAlerts(limit);

  return NextResponse.json(
    {
      ok: true,
      service: "org-chart",
      alerts,
    },
    { headers: { "Cache-Control": "no-store, no-cache, max-age=0" } },
  );
}

export async function POST(request: Request) {
  const [, authErr] = await requireAuth(request);
  if (authErr) return authErr;

  let payload: AutomationAlertInput;
  try {
    payload = (await request.json()) as AutomationAlertInput;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  const alert = normalizeAutomationAlert(payload);
  const persistence = await appendAutomationAlert(alert);

  return NextResponse.json(
    {
      ok: true,
      service: "org-chart",
      event: "internal_tool.alert.received",
      requestId: alert.requestId,
      receivedAt: alert.receivedAt,
      audit: {
        durable: persistence.durable,
        storage: persistence.storage,
      },
    },
    { status: 202, headers: { "Cache-Control": "no-store, no-cache, max-age=0" } },
  );
}
