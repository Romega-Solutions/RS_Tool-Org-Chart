"use client";
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

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
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    itemRefs.current[0]?.focus();

    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  function focusItem(nextIndex: number) {
    const items = itemRefs.current.filter(Boolean);
    if (items.length === 0) return;
    const wrappedIndex = (nextIndex + items.length) % items.length;
    items[wrappedIndex]?.focus();
  }

  function handleMenuKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const items = itemRefs.current.filter(Boolean);
    const currentIndex = items.findIndex((item) => item === document.activeElement);

    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(currentIndex + 1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(currentIndex <= 0 ? items.length - 1 : currentIndex - 1);
      return;
    }

    if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      focusItem(items.length - 1);
    }
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Chart actions"
      onKeyDown={handleMenuKeyDown}
      className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-card py-1 shadow-xl animate-in fade-in zoom-in-95"
      style={{ top: y, left: x }}
    >
      <div className="border-b border-border px-3 py-1.5">
        <p className="text-xs text-muted-foreground">Chart actions</p>
      </div>
      <button
        ref={(node) => {
          itemRefs.current[0] = node;
        }}
        onClick={() => {
          onFitView();
          onClose();
        }}
        role="menuitem"
        className="w-full px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
      >
        Fit Chart
      </button>
      <button
        ref={(node) => {
          itemRefs.current[1] = node;
        }}
        onClick={() => {
          onZoomIn();
          onClose();
        }}
        role="menuitem"
        className="w-full px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
      >
        Zoom In
      </button>
      <button
        ref={(node) => {
          itemRefs.current[2] = node;
        }}
        onClick={() => {
          onZoomOut();
          onClose();
        }}
        role="menuitem"
        className="w-full px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
      >
        Zoom Out
      </button>
      {onClearSelection && (
        <>
          <div className="my-0.5 border-t border-border" />
          <button
            ref={(node) => {
              itemRefs.current[3] = node;
            }}
            onClick={() => {
              onClearSelection();
              onClose();
            }}
            role="menuitem"
            className="w-full px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
          >
            Clear Selection
          </button>
        </>
      )}
    </div>
  );
}
