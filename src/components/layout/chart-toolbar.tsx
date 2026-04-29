"use client";
import { Undo2, Redo2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewSwitcher, type ViewMode } from "@/components/chart/view-switcher";

interface Props {
  view: ViewMode; onViewChange: (view: ViewMode) => void;
  onUndo?: () => void; onRedo?: () => void;
  onZoomIn?: () => void; onZoomOut?: () => void; onFitView?: () => void;
  canUndo?: boolean; canRedo?: boolean; isEditor?: boolean;
  searchSlot?: React.ReactNode;
  treeStats?: { people: number; depth: number };
  density?: "compact" | "comfortable";
  onDensityChange?: (density: "compact" | "comfortable") => void;
}

export function ChartToolbar({
  view, onViewChange, onUndo, onRedo, onZoomIn, onZoomOut, onFitView,
  canUndo = false, canRedo = false, isEditor = false, searchSlot,
  treeStats, density = "comfortable", onDensityChange,
}: Props) {
  return (
    <div className="absolute top-4 left-4 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/88 px-3 py-2 shadow-sm backdrop-blur-sm transition-shadow duration-200 hover:shadow-md">
      <ViewSwitcher value={view} onChange={onViewChange} />
      <div className="w-px h-6 bg-border" />
      {treeStats && (
        <>
          <span className="text-xs text-muted-foreground whitespace-nowrap px-1 tabular-nums">
            {treeStats.people} {treeStats.people === 1 ? "person" : "people"} · {treeStats.depth} {treeStats.depth === 1 ? "level" : "levels"}
          </span>
          <div className="w-px h-6 bg-border" />
        </>
      )}
      {searchSlot}
      {searchSlot && <div className="w-px h-6 bg-border" />}
      
      {isEditor && (<>
        <Button variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo" className="cursor-pointer transition-all duration-200"><Undo2 className="w-4 h-4" /><span className="hidden 2xl:inline ml-1.5">Undo</span></Button>  
        <Button variant="ghost" size="sm" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo" className="cursor-pointer transition-all duration-200"><Redo2 className="w-4 h-4" /><span className="hidden 2xl:inline ml-1.5">Redo</span></Button>  
        <div className="w-px h-6 bg-border" />
      </>)}

      {view === "grid" && onDensityChange && (
        <>
          <Button
            variant={density === "comfortable" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onDensityChange("comfortable")}
            title="Comfortable (2 columns)"
            aria-label="Comfortable grid"
            className="cursor-pointer transition-all duration-200 px-2"
          >
            <span className="text-xs font-medium">2 col</span>
          </Button>
          <Button
            variant={density === "compact" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onDensityChange("compact")}
            title="Compact (4 columns)"
            aria-label="Compact grid"
            className="cursor-pointer transition-all duration-200 px-2"
          >
            <span className="text-xs font-medium">4 col</span>
          </Button>
          <div className="w-px h-6 bg-border" />
        </>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onZoomIn}
        disabled={view === "grid"}
        title={view === "grid" ? "Not available in grid view" : "Zoom In"}
        aria-label="Zoom in"
        className="cursor-pointer transition-all duration-200"
      >
        <ZoomIn className="w-4 h-4" />
        <span className="hidden 2xl:inline ml-1.5">Zoom In</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onZoomOut}
        disabled={view === "grid"}
        title={view === "grid" ? "Not available in grid view" : "Zoom Out"}
        aria-label="Zoom out"
        className="cursor-pointer transition-all duration-200"
      >
        <ZoomOut className="w-4 h-4" />
        <span className="hidden 2xl:inline ml-1.5">Zoom Out</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onFitView}
        disabled={view === "grid"}
        title={view === "grid" ? "Not available in grid view" : "Fit to Screen"}
        aria-label="Fit chart to screen"
        className="cursor-pointer transition-all duration-200"
      >
        <Maximize2 className="w-4 h-4" />
        <span className="hidden 2xl:inline ml-1.5">Fit View</span>
      </Button>
    </div>
  );
}
