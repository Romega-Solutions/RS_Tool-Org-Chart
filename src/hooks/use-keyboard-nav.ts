"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TreeNode } from "@/types";

interface NavMaps {
  parentOf: Map<number, number>;
  childrenOf: Map<number, number[]>;
  siblingsOf: Map<number, number[]>;
  allIds: number[];
}

function buildNavMaps(tree: TreeNode[]): NavMaps {
  const parentOf = new Map<number, number>();
  const childrenOf = new Map<number, number[]>();
  const siblingsOf = new Map<number, number[]>();
  const allIds: number[] = [];

  function walk(node: TreeNode, siblingIds: number[]) {
    allIds.push(node.id);
    siblingsOf.set(node.id, siblingIds);
    const childIds = node.children.map((c) => c.id);
    childrenOf.set(node.id, childIds);
    for (const child of node.children) {
      parentOf.set(child.id, node.id);
      walk(child, childIds);
    }
  }

  const rootIds = tree.map((r) => r.id);
  for (const root of tree) {
    walk(root, rootIds);
  }

  return { parentOf, childrenOf, siblingsOf, allIds };
}

/**
 * Keyboard navigation for tree charts.
 * Arrow keys traverse the tree, Enter opens detail, Escape clears.
 *
 * Returns `focusedNodeId` and a handler to set it externally (e.g. on click).
 */
export function useKeyboardNav(
  tree: TreeNode[],
  onSelectPerson: (person: TreeNode) => void,
  onZoomToNode?: (nodeId: number) => void
) {
  const [focusedNodeId, setFocusedNodeId] = useState<number | null>(null);

  const nav = useMemo(() => buildNavMaps(tree), [tree]);

  // Flatten tree for person lookup
  const personMap = useMemo(() => {
    const map = new Map<number, TreeNode>();
    function walk(node: TreeNode) {
      map.set(node.id, node);
      for (const child of node.children) walk(child);
    }
    for (const root of tree) walk(root);
    return map;
  }, [tree]);

  const moveTo = useCallback(
    (nextId: number | undefined) => {
      if (nextId === undefined) return;
      setFocusedNodeId(nextId);
      onZoomToNode?.(nextId);
    },
    [onZoomToNode]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when focus is in an input, textarea, or dialog
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.closest("[role=dialog]")) return;

      // If no node focused, pressing any arrow focuses the first root
      if (focusedNodeId === null) {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          if (nav.allIds.length > 0) moveTo(nav.allIds[0]);
        }
        return;
      }

      switch (e.key) {
        case "ArrowUp": {
          e.preventDefault();
          const parentId = nav.parentOf.get(focusedNodeId);
          if (parentId !== undefined) moveTo(parentId);
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const children = nav.childrenOf.get(focusedNodeId);
          if (children && children.length > 0) moveTo(children[0]);
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          const siblings = nav.siblingsOf.get(focusedNodeId);
          if (siblings) {
            const idx = siblings.indexOf(focusedNodeId);
            if (idx > 0) moveTo(siblings[idx - 1]);
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const siblings = nav.siblingsOf.get(focusedNodeId);
          if (siblings) {
            const idx = siblings.indexOf(focusedNodeId);
            if (idx < siblings.length - 1) moveTo(siblings[idx + 1]);
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          const person = personMap.get(focusedNodeId);
          if (person) onSelectPerson(person);
          break;
        }
        case "Escape": {
          e.preventDefault();
          setFocusedNodeId(null);
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedNodeId, nav, personMap, onSelectPerson, moveTo]);

  return { focusedNodeId, setFocusedNodeId };
}
