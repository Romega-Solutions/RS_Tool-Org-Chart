import { NextResponse } from "next/server";
import { db, persistOrgChartDbSnapshot } from "@/lib/db/client";
import { departments } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { logChange } from "@/lib/audit";
import { requireAuth, requireEditor, validateString, validateColor, validateInt } from "@/lib/auth";

export async function GET(request: Request) {
  const [, err] = await requireAuth(request);
  if (err) return err;
  const rows = db.select().from(departments).orderBy(asc(departments.displayOrder)).all();
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const [actor, err] = await requireEditor(request);
  if (err) return err;
  const body = await request.json();
  const { name, color, displayOrder } = body;

  const nameErr = validateString(name, "Name", 100);
  if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });
  const colorErr = validateColor(color);
  if (colorErr) return NextResponse.json({ error: colorErr }, { status: 400 });
  const orderErr = validateInt(displayOrder, "Display order");
  if (orderErr) return NextResponse.json({ error: orderErr }, { status: 400 });

  const result = db.insert(departments).values({ name, color: color || null, displayOrder: displayOrder ?? 0 }).returning().get();
  logChange("created", "department", result.id, result.name, actor.username);
  await persistOrgChartDbSnapshot("departments:create");
  return NextResponse.json(result, { status: 201 });
}
