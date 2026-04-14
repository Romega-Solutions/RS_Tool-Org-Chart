"use client";
import { useCallback, useMemo, useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { TreeNode } from "@/types";

const PATH_EDGE_STYLE = {
  stroke: "hsl(209, 100%, 50%)",
  strokeWidth: 3,
  opacity: 1,
};

const DIM_EDGE_STYLE = {
  stroke: "hsl(209, 20%, 70%)",
  strokeWidth: 1,
  opacity: 0.15,
};

/**
 * Hook that provides path-highlighting on node hover and multi-select.
 * When hovering OR selecting nodes, their ancestor chains light up.
 */
export function usePathHighlight(tree: TreeNode[], selectedNodeIds?: number[]) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Map each node ID to the set of ancestor IDs (including itself)
  const ancestorsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    function walk(node: TreeNode, ancestors: string[]) {
      const nodeId = String(node.id);
      const chain = new Set([...ancestors, nodeId]);
      map.set(nodeId, chain);
      for (const child of node.children) {
        walk(child, [...ancestors, nodeId]);
      }
    }
    for (const root of tree) walk(root, []);
    return map;
  }, [tree]);

  // Combined path set: hover path + all selected nodes' paths
  const activePathSet = useMemo(() => {
    const combined = new Set<string>();

    if (hoveredNodeId) {
      const hoverPath = ancestorsMap.get(hoveredNodeId);
      if (hoverPath) hoverPath.forEach((id) => combined.add(id));
    }

    if (selectedNodeIds && selectedNodeIds.length > 0) {
      for (const nodeId of selectedNodeIds) {
        const path = ancestorsMap.get(String(nodeId));
        if (path) path.forEach((id) => combined.add(id));
      }
    }

    return combined;
  }, [hoveredNodeId, selectedNodeIds, ancestorsMap]);

  const isActive = activePathSet.size > 0;

  const handleNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setHoveredNodeId(node.id);
    },
    []
  );

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  // Apply path highlight data to nodes
  const applyToNodes = useCallback(
    (nodes: Node[]): Node[] => {
      if (!isActive) {
        return nodes.map((n) => ({
          ...n,
          data: { ...n.data, pathHighlighted: false, dimmed: false },
        }));
      }

      return nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          pathHighlighted: activePathSet.has(n.id),
          dimmed: !activePathSet.has(n.id),
        },
      }));
    },
    [isActive, activePathSet]
  );

  // Apply path highlight styles to edges
  const applyToEdges = useCallback(
    (edges: Edge[]): Edge[] => {
      if (!isActive) {
        return edges.map((e) => ({
          ...e,
          style: undefined,
          animated: false,
        }));
      }

      return edges.map((e) => {
        const inPath = activePathSet.has(e.source) && activePathSet.has(e.target);
        return {
          ...e,
          style: inPath ? PATH_EDGE_STYLE : DIM_EDGE_STYLE,
          animated: inPath,
        };
      });
    },
    [isActive, activePathSet]
  );

  return {
    hoveredNodeId,
    handleNodeMouseEnter,
    handleNodeMouseLeave,
    applyToNodes,
    applyToEdges,
  };
}
