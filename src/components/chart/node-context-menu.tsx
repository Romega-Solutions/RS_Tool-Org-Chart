"use client";
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { TreeNode } from "@/types";

interface Props {
  x: number;
  y: number;
  person: TreeNode;
  onClose: () => void;
  onEdit: () => void;
  onToggle?: () => void;
  onDelete?: () => void;
}

export function NodeContextMenu({ x, y, person, onClose, onEdit, onToggle, onDelete }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const hasEditorActions = Boolean(onToggle || onDelete);

  useEffect(() => {
    itemRefs.current[0]?.focus();

    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
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
      aria-label={`${person.name} actions`}
      onKeyDown={handleMenuKeyDown}
      className="fixed z-50 min-w-[160px] rounded-lg border border-border bg-card shadow-xl py-1 animate-in fade-in zoom-in-95"
      style={{ top: y, left: x }}
    >
      <div className="px-3 py-1.5 border-b border-border">
        <p className="text-xs text-muted-foreground truncate">{person.name}</p>
      </div>
      <button
        ref={(node) => {
          itemRefs.current[0] = node;
        }}
        onClick={onEdit}
        role="menuitem"
        className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
      >
        {hasEditorActions ? "Open Details" : "View Details"}
      </button>
      {onToggle && (
        <button
          ref={(node) => {
            itemRefs.current[1] = node;
          }}
          onClick={onToggle}
          role="menuitem"
          className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
        >
          {person.isActive ? "Deactivate" : "Activate"}
        </button>
      )}
      {onDelete && (
        <>
          <div className="border-t border-border my-0.5" />
          <button
            ref={(node) => {
              itemRefs.current[2] = node;
            }}
            onClick={onDelete}
            role="menuitem"
            className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
}
