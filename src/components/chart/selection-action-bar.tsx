"use client";
import { CheckCircle2, XCircle, Trash2, X, MousePointerSquareDashed } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  count: number;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onClear: () => void;
  busy?: boolean;
}

export function SelectionActionBar({ count, onActivate, onDeactivate, onDelete, onClear, busy }: Props) {
  if (count === 0) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-2xl border border-rs-primary-500/30 bg-card/95 backdrop-blur-md px-5 py-3 shadow-xl animate-in fade-in slide-in-from-bottom-3">
      <MousePointerSquareDashed className="w-4 h-4 text-rs-primary-400" />
      <span className="text-sm font-medium text-foreground">
        {count} {count === 1 ? "person" : "people"} selected
      </span>
      <div className="w-px h-5 bg-border" />
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={onActivate}
        className="text-emerald-600 hover:text-emerald-500 hover:bg-emerald-500/10 dark:text-emerald-400 cursor-pointer"
      >
        <CheckCircle2 className="size-4" />
        Activate
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={onDeactivate}
        className="text-amber-600 hover:text-amber-500 hover:bg-amber-500/10 dark:text-amber-400 cursor-pointer"
      >
        <XCircle className="size-4" />
        Deactivate
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={onDelete}
        className="text-red-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
      >
        <Trash2 className="size-4" />
        Delete
      </Button>
      <div className="w-px h-5 bg-border" />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClear}
        title="Clear selection (Esc)"
        className="cursor-pointer"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
