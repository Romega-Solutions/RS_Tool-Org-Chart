import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [, err] = await requireAuth(request);
  if (err) return err;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "50"), 1), 500);
  const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);
  const offset = (page - 1) * limit;

  const rows = db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(limit).offset(offset).all();
  const totalRow = db.select({ count: sql<number>`count(*)` }).from(auditLog).get();
  const total = totalRow?.count ?? 0;

  return NextResponse.json({
    entries: rows,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}
