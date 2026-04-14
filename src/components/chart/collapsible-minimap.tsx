"use client";
import { useState } from "react";
import { MiniMap } from "@xyflow/react";
import { Map, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Must be rendered INSIDE a <ReactFlow> component (needs zustand context).
 */
export function CollapsibleMinimap() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Toggle button — always visible */}
      <div className="react-flow__panel bottom right" style={{ margin: 10 }}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-center justify-center size-8 rounded-lg border border-border bg-card/90 backdrop-blur-sm shadow-md cursor-pointer transition-all duration-200 hover:bg-muted"
          title={open ? "Hide minimap" : "Show minimap"}
          aria-label={open ? "Hide minimap" : "Show minimap"}
        >
          {open ? (
            <X className="size-3.5 text-muted-foreground" />
          ) : (
            <Map className="size-3.5 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* MiniMap — hidden via CSS when collapsed */}
      <div
        className={cn(
          "transition-all duration-200 ease-out",
          open
            ? "[&_.react-flow__minimap]:opacity-100 [&_.react-flow__minimap]:scale-100 [&_.react-flow__minimap]:pointer-events-auto"
            : "[&_.react-flow__minimap]:opacity-0 [&_.react-flow__minimap]:scale-75 [&_.react-flow__minimap]:pointer-events-none [&_.react-flow__minimap]:!h-0 [&_.react-flow__minimap]:!w-0"
        )}
      >
        <MiniMap
          pannable
          zoomable
          className="!bg-card/90 !border-border !rounded-lg !shadow-md !transition-all !duration-200 !ease-out !origin-bottom-right"
          maskColor="rgba(0,0,0,0.08)"
          nodeColor={(n) => (n.data?.departmentColor as string) || "hsl(209, 60%, 50%)"}
          style={{ marginBottom: 44 }}
        />
      </div>
    </>
  );
}
