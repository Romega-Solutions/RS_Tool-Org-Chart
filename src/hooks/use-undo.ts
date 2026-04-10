"use client";
import { useRef, useState, useCallback } from "react";
import { UndoStack } from "@/lib/undo";

export function useUndo() {
  const stackRef = useRef(new UndoStack());
  const [, forceUpdate] = useState(0);

  const push = useCallback(
    (action: {
      description: string;
      undo: () => Promise<void>;
      redo: () => Promise<void>;
    }) => {
      stackRef.current.push(action);
      forceUpdate((n) => n + 1);
    },
    []
  );

  const undo = useCallback(async () => {
    await stackRef.current.undo();
    forceUpdate((n) => n + 1);
  }, []);

  const redo = useCallback(async () => {
    await stackRef.current.redo();
    forceUpdate((n) => n + 1);
  }, []);

  return {
    push,
    undo,
    redo,
    canUndo: stackRef.current.canUndo,
    canRedo: stackRef.current.canRedo,
  };
}
