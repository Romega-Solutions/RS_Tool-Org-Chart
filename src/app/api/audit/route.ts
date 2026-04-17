import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);
  const rows = db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(limit).all();
  return NextResponse.json(rows);
}
