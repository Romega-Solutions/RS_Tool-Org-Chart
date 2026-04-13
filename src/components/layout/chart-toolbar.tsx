"use client";
import { Undo2, Redo2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewSwitcher } from "@/components/chart/view-switcher";

interface Props {
  view: string; onViewChange: (view: string) => void;
  onUndo?: () => void; onRedo?: () => void;
  onZoomIn?: () => void; onZoomOut?: () => void; onFitView?: () => void;
  canUndo?: boolean; canRedo?: boolean; isEditor?: boolean;
}

export function ChartToolbar({ view, onViewChange, onUndo, onRedo, onZoomIn, onZoomOut, onFitView, canUndo = false, canRedo = false, isEditor = false }: Props) {
  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-border">
      <ViewSwitcher value={view} onChange={onViewChange} />
      <div className="w-px h-6 bg-border" />
      {isEditor && (<>
        <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)"><Redo2 className="w-4 h-4" /></Button>
        <div className="w-px h-6 bg-border" />
      </>)}
      <Button variant="ghost" size="icon" onClick={onZoomIn} title="Zoom In"><ZoomIn className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" onClick={onZoomOut} title="Zoom Out"><ZoomOut className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" onClick={onFitView} title="Fit to Screen"><Maximize2 className="w-4 h-4" /></Button>
    </div>
  );
}
