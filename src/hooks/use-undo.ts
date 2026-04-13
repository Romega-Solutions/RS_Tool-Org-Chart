"use client";
import { useRef, useState, useCallback } from "react";
import { UndoStack } from "@/lib/undo";

export function useUndo() {
  const stackRef = useRef(new UndoStack());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(stackRef.current.canUndo);
    setCanRedo(stackRef.current.canRedo);
  }, []);

  const push = useCallback(
    (action: {
      description: string;
      undo: () => Promise<void>;
      redo: () => Promise<void>;
    }) => {
      stackRef.current.push(action);
      syncFlags();
    },
    [syncFlags]
  );

  const undo = useCallback(async () => {
    await stackRef.current.undo();
    syncFlags();
  }, [syncFlags]);

  const redo = useCallback(async () => {
    await stackRef.current.redo();
    syncFlags();
  }, [syncFlags]);

  return {
    push,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
