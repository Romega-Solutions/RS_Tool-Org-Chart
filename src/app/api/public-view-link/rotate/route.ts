import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth";
import { persistOrgChartDbSnapshot } from "@/lib/db/client";
import { getPublicRequestOrigin, getPublicViewUrl, rotatePublicViewLink } from "@/lib/public-view-link";

export async function POST(request: Request) {
  const [, err] = await requireEditor(request);
  if (err) return err;

  const link = rotatePublicViewLink();
  await persistOrgChartDbSnapshot("public-view-link:rotate");
  const origin = getPublicRequestOrigin(request);
  return NextResponse.json({
    code: link.code,
    url: getPublicViewUrl(origin, link.code),
    expiresAt: link.expiresAt,
  });
}
