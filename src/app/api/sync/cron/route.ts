import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/sync/cron — External cron trigger for Google Sheets sync.
 *
 * Protected by CRON_SECRET env var. Call with:
 *   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync/cron
 *
 * The handler delegates to POST /api/sync (same-origin fetch) so all
 * sync logic stays in one place.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET env var not configured on the server" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if a sheets_url is configured
  const sheetsUrlRow = db
    .select()
    .from(settings)
    .where(eq(settings.key, "sheets_url"))
    .get();

  if (!sheetsUrlRow?.value) {
    return NextResponse.json(
      { skipped: true, reason: "No sheets_url configured" },
      { status: 200 }
    );
  }

  // Delegate to the existing POST /api/sync handler via internal fetch
  const origin = request.headers.get("host") ?? "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";
  const syncUrl = `${protocol}://${origin}/api/sync`;

  try {
    const res = await fetch(syncUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: sheetsUrlRow.value }),
    });
    const data = await res.json();
    return NextResponse.json({ ...data, triggered_by: "cron" }, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: `Internal sync call failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
