"use client";
import { useEffect, useRef } from "react";

interface Props {
  x: number;
  y: number;
  onClose: () => void;
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onClearSelection?: () => void;
}

export function ChartContextMenu({
  x,
  y,
  onClose,
  onFitView,
  onZoomIn,
  onZoomOut,
  onClearSelection,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-card py-1 shadow-xl animate-in fade-in zoom-in-95"
      style={{ top: y, left: x }}
    >
      <div className="border-b border-border px-3 py-1.5">
        <p className="text-xs text-muted-foreground">Chart actions</p>
      </div>
      <button
        onClick={() => {
          onFitView();
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
      >
        Fit Chart
      </button>
      <button
        onClick={() => {
          onZoomIn();
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
      >
        Zoom In
      </button>
      <button
        onClick={() => {
          onZoomOut();
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
      >
        Zoom Out
      </button>
      {onClearSelection && (
        <>
          <div className="my-0.5 border-t border-border" />
          <button
            onClick={() => {
              onClearSelection();
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
          >
            Clear Selection
          </button>
        </>
      )}
    </div>
  );
}
