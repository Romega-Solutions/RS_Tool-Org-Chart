"use client";
import { useEffect, useRef } from "react";
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
  const hasEditorActions = Boolean(onToggle || onDelete);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
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
      className="fixed z-50 min-w-[160px] rounded-lg border border-border bg-card shadow-xl py-1 animate-in fade-in zoom-in-95"
      style={{ top: y, left: x }}
    >
      <div className="px-3 py-1.5 border-b border-border">
        <p className="text-xs text-muted-foreground truncate">{person.name}</p>
      </div>
      <button
        onClick={onEdit}
        className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
      >
        {hasEditorActions ? "Open Details" : "View Details"}
      </button>
      {onToggle && (
        <button
          onClick={onToggle}
          className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
        >
          {person.isActive ? "Deactivate" : "Activate"}
        </button>
      )}
      {onDelete && (
        <>
          <div className="border-t border-border my-0.5" />
          <button
            onClick={onDelete}
            className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
}
