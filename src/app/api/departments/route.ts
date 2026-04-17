import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { departments } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { logChange } from "@/lib/audit";
import { getUserFromRequest } from "@/lib/auth";

export async function GET() {
  const rows = db.select().from(departments).orderBy(asc(departments.displayOrder)).all();
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const actor = await getUserFromRequest(request);
  const body = await request.json();
  const { name, color, displayOrder } = body;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const result = db.insert(departments).values({ name, color: color || null, displayOrder: displayOrder ?? 0 }).returning().get();
  logChange("created", "department", result.id, result.name, actor?.username ?? null);
  return NextResponse.json(result, { status: 201 });
}
