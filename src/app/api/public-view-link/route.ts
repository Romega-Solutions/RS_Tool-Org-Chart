import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth";
import { ensurePublicViewLink, getPublicRequestOrigin, getPublicViewUrl } from "@/lib/public-view-link";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [, err] = await requireEditor(request);
  if (err) return err;

  const link = ensurePublicViewLink();
  const origin = getPublicRequestOrigin(request);
  return NextResponse.json({
    code: link.code,
    url: getPublicViewUrl(origin, link.code),
    expiresAt: link.expiresAt,
  });
}
