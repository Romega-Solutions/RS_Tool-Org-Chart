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
}

export function ChartToolbar({ view, onViewChange, onUndo, onRedo, onZoomIn, onZoomOut, onFitView, canUndo = false, canRedo = false, isEditor = false, searchSlot }: Props) {
  return (
    <div className="absolute top-4 left-4 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/88 px-3 py-2 shadow-sm backdrop-blur-sm transition-shadow duration-200 hover:shadow-md">
      <ViewSwitcher value={view} onChange={onViewChange} />
      <div className="w-px h-6 bg-border" />
      {searchSlot}
      {searchSlot && <div className="w-px h-6 bg-border" />}
      {isEditor && (<>
        <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" className="cursor-pointer transition-all duration-200"><Undo2 className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" className="cursor-pointer transition-all duration-200"><Redo2 className="w-4 h-4" /></Button>
        <div className="w-px h-6 bg-border" />
      </>)}
      <Button variant="ghost" size="icon" onClick={onZoomIn} title="Zoom In" className="cursor-pointer transition-all duration-200"><ZoomIn className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" onClick={onZoomOut} title="Zoom Out" className="cursor-pointer transition-all duration-200"><ZoomOut className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" onClick={onFitView} title="Fit to Screen" className="cursor-pointer transition-all duration-200"><Maximize2 className="w-4 h-4" /></Button>
    </div>
  );
}
