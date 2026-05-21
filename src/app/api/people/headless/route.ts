import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { people, departments } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireEditor, checkGlobalRateLimit } from "@/lib/auth";
import { staffProfileFields, type StaffProfile } from "@/lib/automation/schema";

export const dynamic = "force-dynamic";

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
  const includeInactive = includeInactiveRaw === "true";

  const query = db
    .select({
      id: people.id,
      name: people.name,
      title: people.title,
      departmentId: people.departmentId,
      departmentName: departments.name,
      departmentColor: departments.color,
      reportsTo: people.reportsTo,
      photoUrl: people.photoUrl,
      email: people.email,
      displayOrder: people.displayOrder,
      isActive: people.isActive,
      employmentType: people.employmentType,
      projectIds: people.projectIds,
    })
    .from(people)
    .leftJoin(departments, eq(people.departmentId, departments.id))
    .orderBy(asc(people.displayOrder));

  const rows = includeInactive ? query.all() : query.where(eq(people.isActive, true)).all();
  const staffProfiles: StaffProfile[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    title: row.title,
    email: row.email,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    managerId: row.reportsTo,
    isActive: row.isActive,
  }));

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
