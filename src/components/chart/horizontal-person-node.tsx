"use client";
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Identical to PersonNode but with Handle positions for horizontal (left-to-right) layout:
 * - Target handle on the Left (incoming edge from parent)
 * - Source handle on the Right (outgoing edge to children)
 */
function HorizontalPersonNodeComponent({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const name = data.name as string;
  const title = data.title as string;
  const photoUrl = data.photoUrl as string | null;
  const departmentColor = data.departmentColor as string | null;
  const isRoot = data.isRoot as boolean;

  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="bg-card border border-border rounded-lg p-3 min-w-[160px] shadow-lg hover:border-rs-primary-400 transition-colors cursor-pointer"
      style={{
        borderLeftColor: departmentColor || undefined,
        borderLeftWidth: 3,
      }}
    >
      {!isRoot && (
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-rs-primary-500 !w-2 !h-2"
        />
      )}
      <div className="flex items-center gap-3">
        <Avatar className="w-10 h-10">
          {photoUrl && <AvatarImage src={photoUrl} />}
          <AvatarFallback className="bg-rs-primary-500/20 text-rs-primary-400 text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-medium text-sm text-foreground truncate">
            {name}
          </p>
          <p className="text-xs text-muted-foreground truncate">{title}</p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-rs-primary-500 !w-2 !h-2"
      />
    </div>
  );
}

export const HorizontalPersonNode = memo(HorizontalPersonNodeComponent);
