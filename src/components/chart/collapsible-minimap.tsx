"use client";
import { useState } from "react";
import { MiniMap, Panel, useNodes, useViewport } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import { Map as MapIcon, X, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Must be rendered INSIDE a <ReactFlow> component (needs zustand context).
 */
export function CollapsibleMinimap() {
  const [open, setOpen] = useState(false);
  const allNodes = useNodes();
  const { zoom } = useViewport();

  // Collect unique department colors for the legend
  const departments = open
    ? Array.from(
        new Set(
          allNodes
            .map((n) => (n.data?.departmentColor as string) || null)
            .filter(Boolean) as string[]
        )
      )
    : [];

  const nodeCount = allNodes.length;
  const zoomPct = Math.round(zoom * 100);

  return (
    <div data-export-ignore="true">
      {/* MiniMap panel — animated in/out */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.75, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.75, y: 16 }}
            transition={{ type: "spring", damping: 24, stiffness: 340 }}
            style={{
              position: "absolute",
              bottom: 54,
              right: 10,
              zIndex: 5,
              transformOrigin: "bottom right",
            }}
          >
            <div className="rounded-xl border border-border/80 bg-card/92 shadow-xl backdrop-blur-md overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-1.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Overview
                </span>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums">
                  <span className="flex items-center gap-0.5">
                    <Minus className="size-2.5" />
                    {zoomPct}%
                    <Plus className="size-2.5" />
                  </span>
                  <span className="w-px h-3 bg-border" />
                  <span>{nodeCount} nodes</span>
                </div>
              </div>

              {/* Map */}
              <MiniMap
                pannable
                zoomable
                className="!bg-transparent !border-0 !rounded-none !shadow-none !static"
                maskColor="rgba(0,0,0,0.06)"
                nodeColor={(n) =>
                  (n.data?.departmentColor as string) || "hsl(209, 60%, 50%)"
                }
              />

              {/* Department color legend */}
              {departments.length > 0 && (
                <div className="flex items-center gap-1.5 border-t border-border/60 px-3 py-1.5">
                  <span className="text-[9px] text-muted-foreground mr-0.5">Depts</span>
                  {departments.map((color) => (
                    <span
                      key={color}
                      className="size-2 rounded-full ring-1 ring-border/40"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <Panel position="bottom-right" style={{ marginRight: 10, marginBottom: 10 }}>
        <motion.button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className={cn(
            "relative flex items-center gap-1.5 rounded-xl border shadow-md cursor-pointer backdrop-blur-sm transition-colors duration-200",
            open
              ? "border-rs-primary-400/40 bg-rs-primary-500/10 hover:bg-rs-primary-500/18 px-2.5 py-1.5"
              : "border-border bg-card/90 hover:bg-muted size-9 justify-center"
          )}
          title={open ? "Hide minimap" : "Show minimap"}
          aria-label={open ? "Hide minimap" : "Show minimap"}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={open ? "close" : "open"}
              initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-center"
            >
              {open ? (
                <X className="size-3.5 text-rs-primary-500" />
              ) : (
                <MapIcon className="size-4 text-muted-foreground" />
              )}
            </motion.span>
          </AnimatePresence>
          {open && (
            <span className="text-[10px] font-medium text-rs-primary-500">
              {zoomPct}%
            </span>
          )}
        </motion.button>
      </Panel>
    </div>
  );
}
