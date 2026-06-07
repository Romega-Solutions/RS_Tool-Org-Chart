import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildEmailSignatureUrl } from "@/lib/email-signature-url";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

async function redirectToEmailSignature(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  return NextResponse.redirect(buildEmailSignatureUrl(path.join("/"), request.nextUrl.search), 307);
}

export const GET = redirectToEmailSignature;
export const POST = redirectToEmailSignature;
export const PUT = redirectToEmailSignature;
export const PATCH = redirectToEmailSignature;
export const DELETE = redirectToEmailSignature;
