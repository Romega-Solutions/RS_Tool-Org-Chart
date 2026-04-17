import { db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";

export type AuditAction = "created" | "updated" | "deleted" | "activated" | "deactivated";
export type AuditEntity = "person" | "department" | "setting";

export function logChange(
  action: AuditAction,
  entityType: AuditEntity,
  entityId: number | null,
  entityName: string,
  actor: string | null,
  changes?: Record<string, unknown>
): void {
  db.insert(auditLog).values({
    action,
    entityType,
    entityId,
    entityName,
    actor: actor ?? "system",
    changes: changes ? JSON.stringify(changes) : null,
  }).run();
}
