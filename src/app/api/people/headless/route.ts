import { NextResponse } from "next/server";
import { requireEditor, checkGlobalRateLimit } from "@/lib/auth";
import { staffProfileFields } from "@/lib/automation/schema";
import { loadStaffProfiles } from "@/lib/directory";

export const dynamic = "force-dynamic";

// Read-only staff list for the n8n staff snapshot (Certificate Creator, Email Signature).
// Data comes from the Employee Portal; edit people there.
export async function GET(request: Request) {
  const rateLimitErr = checkGlobalRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  const [, authErr] = await requireEditor(request);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const includeInactiveRaw = searchParams.get("includeInactive");
  if (includeInactiveRaw && includeInactiveRaw !== "true" && includeInactiveRaw !== "false") {
    return NextResponse.json({ error: "includeInactive must be true or false" }, { status: 400 });
  }

  const staffProfiles = await loadStaffProfiles(includeInactiveRaw === "true");

  return NextResponse.json(
    {
      people: staffProfiles,
      contract: {
        version: "1.0",
        profileFields: staffProfileFields,
      },
    },
    { headers: { "Cache-Control": "no-store, no-cache, max-age=0" } },
  );
}
