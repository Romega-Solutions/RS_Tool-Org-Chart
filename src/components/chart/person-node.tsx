"use client";
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function PersonNodeComponent({ data }: { data: Record<string, unknown> }) {
  const name = data.name as string;
  const title = data.title as string;
  const photoUrl = data.photoUrl as string | null;
  const departmentColor = data.departmentColor as string | null;
  const isRoot = data.isRoot as boolean;
  const highlighted = data.highlighted as boolean | undefined;
  const pathHighlighted = data.pathHighlighted as boolean | undefined;
  const dimmed = data.dimmed as boolean | undefined;
  const dropTarget = data.dropTarget as boolean | string | undefined;

  const isReassign = dropTarget === true;
  const isReorder =
    dropTarget === "reorder-before" || dropTarget === "reorder-after";
  const isDropActive = isReassign || isReorder;

  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        "group relative transition-all duration-200",
        dimmed && "opacity-30 scale-[0.97]",
        isDropActive && "scale-[1.06] z-50"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-4 -bottom-3 h-6 rounded-full bg-rs-neutral-900/12 blur-md transition-all duration-200 dark:bg-black/35",
          (highlighted || pathHighlighted) &&
            "bg-rs-primary-500/18 dark:bg-rs-primary-400/20"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-[-7px] rounded-[1.05rem] bg-white/72 opacity-85 blur-lg transition-all duration-200 dark:bg-white/[0.03] dark:opacity-100",
          (highlighted || pathHighlighted) &&
            "bg-rs-primary-500/8 dark:bg-rs-primary-400/10"
        )}
      />
      <div
        className={cn(
          "relative w-[160px] bg-card/98 backdrop-blur-[2px] border border-white/70 rounded-lg px-3 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.10),0_2px_0_rgba(255,255,255,0.65)_inset] hover:shadow-[0_24px_55px_rgba(15,23,42,0.14),0_2px_0_rgba(255,255,255,0.75)_inset] hover:border-rs-primary-300 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer dark:border-border dark:shadow-[0_20px_45px_rgba(0,0,0,0.34)] dark:hover:shadow-[0_24px_55px_rgba(0,0,0,0.42)]",
          highlighted &&
            "ring-2 ring-rs-primary-500 shadow-[0_26px_60px_rgba(0,112,224,0.18),0_2px_0_rgba(255,255,255,0.8)_inset] border-rs-primary-300 -translate-y-0.5 dark:shadow-[0_28px_60px_rgba(14,165,233,0.18)]",
          pathHighlighted &&
            "border-rs-primary-400 shadow-[0_24px_55px_rgba(0,112,224,0.12),0_2px_0_rgba(255,255,255,0.75)_inset] -translate-y-0.5 dark:border-rs-primary-500 dark:shadow-[0_24px_55px_rgba(14,165,233,0.14)]",
          isReassign &&
            "ring-[3px] ring-rs-accent-500 border-rs-accent-400 shadow-[0_0_24px_rgba(200,133,10,0.35),0_0_48px_rgba(200,133,10,0.15)] animate-pulse",
          isReorder &&
            "ring-[3px] ring-teal-500 border-teal-400 shadow-[0_0_24px_rgba(20,184,166,0.35),0_0_48px_rgba(20,184,166,0.15)] animate-pulse"
        )}
        style={{
          borderLeftColor: departmentColor || undefined,
          borderLeftWidth: 3,
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/75 via-white/28 to-transparent dark:from-white/[0.06] dark:via-transparent dark:to-transparent" />
        {!isRoot && (
          <Handle
            type="target"
            position={Position.Top}
            className="!bg-rs-primary-500 !w-2 !h-2"
          />
        )}
        <div className="relative flex flex-col items-center gap-2 text-center">
          <Avatar className="h-11 w-11 shadow-sm ring-1 ring-border/60">
            {photoUrl && <AvatarImage src={photoUrl} />}
            <AvatarFallback className="bg-rs-primary-500/20 text-rs-primary-400 text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 w-full">
            <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground" title={name}>
              {name}
            </p>
            <p className="mt-1 line-clamp-2 text-[0.7rem] leading-snug text-muted-foreground" title={title}>
              {title}
            </p>
          </div>
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-rs-primary-500 !w-2 !h-2"
        />
        {isReassign && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-rs-accent-500 px-2 py-0.5 text-[0.6rem] font-semibold text-white shadow-lg">
            Drop to reassign
          </div>
        )}
        {isReorder && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-teal-500 px-2 py-0.5 text-[0.6rem] font-semibold text-white shadow-lg">
            {dropTarget === "reorder-before" ? "Move before" : "Move after"}
          </div>
        )}
      </div>
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
