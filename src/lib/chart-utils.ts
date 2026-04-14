import type { Node } from "@xyflow/react";

/**
 * Compute a translate extent (panning boundary) from node positions.
 * Adds generous padding so the user can scroll a bit beyond the chart
 * but can't pan infinitely.
 */
export function computeTranslateExtent(
  nodes: Node[],
  padding = 600
): [[number, number], [number, number]] {
  if (nodes.length === 0) {
    return [
      [-1000, -1000],
      [1000, 1000],
    ];
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + 200);
    maxY = Math.max(maxY, node.position.y + 120);
  }

  return [
    [minX - padding, minY - padding],
    [maxX + padding, maxY + padding],
  ];
}
