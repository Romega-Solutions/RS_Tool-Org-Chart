import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth";
import { getPublicViewUrl, rotatePublicViewLink } from "@/lib/public-view-link";

export async function POST(request: Request) {
  const [, err] = await requireEditor(request);
  if (err) return err;

  const link = rotatePublicViewLink();
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    code: link.code,
    url: getPublicViewUrl(origin, link.code),
    expiresAt: link.expiresAt,
  });
}
