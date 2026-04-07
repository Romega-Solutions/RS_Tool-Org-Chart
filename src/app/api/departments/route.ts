import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { departments } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const rows = db.select().from(departments).orderBy(asc(departments.displayOrder)).all();
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, color, displayOrder } = body;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const result = db.insert(departments).values({ name, color: color || null, displayOrder: displayOrder ?? 0 }).returning().get();
  return NextResponse.json(result, { status: 201 });
}
