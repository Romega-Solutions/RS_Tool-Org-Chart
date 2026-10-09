"use client";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";
import { PersonNode } from "./person-node";
import { ChartBackgroundDecor } from "./chart-background-decor";
import { NodeContextMenu } from "./node-context-menu";
import { CollapsibleMinimap } from "./collapsible-minimap";
import { usePathHighlight } from "@/hooks/use-path-highlight";
import { computeTranslateExtent } from "@/lib/chart-utils";
import type { TreeNode } from "@/types";

const Y_GAP = 160;
const GRID_X_GAP = 200;
const GRID_ROW_GAP = Y_GAP;
const NODE_GAP = 50;
const NODE_WIDTH = 160;

const EDGE_STYLE = {
  stroke: "var(--chart-edge-stroke)",
  strokeWidth: 1.5,
  opacity: 0.9,
};

const SECONDARY_EDGE_STYLE = {
  stroke: "var(--chart-edge-stroke)",
  strokeWidth: 1.4,
  strokeDasharray: "6 5",
  opacity: 0.65,
};

const nodeTypes = { person: PersonNode };

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  person: TreeNode;
}

interface Props {
  tree: TreeNode[];
  onNodeClick: (person: TreeNode) => void;
  onInit?: (instance: ReactFlowInstance) => void;
  onBackgroundContextMenu?: (x: number, y: number) => void;
  selectedNodeIds?: number[];
  highlightedNodeId?: number | null;
}

// ---------------------------------------------------------------------------
// Contour-based tree layout with leaf-grid optimisation
//
// Bottom-up:  compute each subtree's left/right contour (min/max x per depth)
// Placement:  slide adjacent child subtrees together until contours touch
// Centering:  parent centred over visual midpoint of its children
// Grids:      2+ leaf siblings packed into ceil(sqrt(n)) columns
// ---------------------------------------------------------------------------

/** How many columns a leaf grid should use. */
function getLeafCols(n: number): number {
  if (n <= 1) return 1;
  return Math.ceil(Math.sqrt(n));
}

/** A positioned node relative to its subtree root. */
interface PosEntry {
  node: TreeNode;
  dx: number;    // x offset from subtree root
  depth: number; // depth level (0 = subtree root)
  yOffset: number; // extra Y within a depth level (used for grid rows)
}

/** Result of laying out one subtree. */
interface SubtreeResult {
  left: number[];   // leftmost x at each depth (relative to root x)
  right: number[];  // rightmost x + NODE_WIDTH at each depth
  positions: PosEntry[];
}

/** Lay out a subtree bottom-up — returns positions relative to root x=0. */
function layoutSubtree(node: TreeNode): SubtreeResult {
  // Leaf — single node, no children
  if (node.children.length === 0) {
    return {
      left: [0],
      right: [NODE_WIDTH],
      positions: [{ node, dx: 0, depth: 0, yOffset: 0 }],
    };
  }

  const allLeaves = node.children.filter((c) => c.children.length === 0);
  const branches = node.children.filter((c) => c.children.length > 0);
  const useGrid = allLeaves.length >= 2;

  // Build child items to place left-to-right via contour separation
  const childItems: SubtreeResult[] = [];

  // Branch children — recursively compute their layouts
  for (const branch of branches) {
    childItems.push(layoutSubtree(branch));
  }

  // Leaf children — grid block or individual nodes
  if (useGrid) {
    const cols = getLeafCols(allLeaves.length);
    const rows = Math.ceil(allLeaves.length / cols);
    const positions: PosEntry[] = [];

    // Each grid row claims a contour depth level so adjacent subtrees
    // don't place nodes into the vertical space the grid occupies.
    const left: number[] = [];
    const right: number[] = [];
    for (let r = 0; r < rows; r++) {
      const itemsInRow = r < rows - 1 ? cols : allLeaves.length - r * cols;
      const rowWidth = (itemsInRow - 1) * GRID_X_GAP + NODE_WIDTH;
      left.push(0);
      right.push(rowWidth);
    }

    // Position leaves with yOffset for rows within the single depth level
    for (let i = 0; i < allLeaves.length; i++) {
      const row = Math.floor(i / cols);
      positions.push({
        node: allLeaves[i],
        dx: (i % cols) * GRID_X_GAP,
        depth: 0,
        yOffset: row * GRID_ROW_GAP,
      });
    }

    childItems.push({ left, right, positions });
  } else {
    for (const leaf of allLeaves) {
      childItems.push({
        left: [0],
        right: [NODE_WIDTH],
        positions: [{ node: leaf, dx: 0, depth: 0, yOffset: 0 }],
      });
    }
  }

  // --- Place children left-to-right using contour separation ---
  const offsets: number[] = [];
  let mergedRight: number[] = [];

  for (let i = 0; i < childItems.length; i++) {
    const child = childItems[i];

    if (i === 0) {
      offsets.push(0);
      mergedRight = [...child.right];
    } else {
      // Slide child as far left as contours allow
      let minOff = 0;
      const maxD = Math.min(mergedRight.length, child.left.length);
      for (let d = 0; d < maxD; d++) {
        const needed = mergedRight[d] + NODE_GAP - child.left[d];
        if (needed > minOff) minOff = needed;
      }
      // If no depth overlap, ensure top-level gap
      if (maxD === 0 && mergedRight.length > 0) {
        minOff = Math.max(minOff, mergedRight[0] + NODE_GAP);
      }

      offsets.push(minOff);

      // Extend merged right contour
      for (let d = 0; d < child.right.length; d++) {
        const r = child.right[d] + minOff;
        if (d < mergedRight.length) {
          mergedRight[d] = Math.max(mergedRight[d], r);
        } else {
          mergedRight.push(r);
        }
      }
    }
  }

  // --- Centre parent over children ---
  const first = offsets[0] ?? 0;
  const last = offsets[offsets.length - 1] ?? 0;
  const lastRight = childItems.length > 0 ? childItems[childItems.length - 1].right[0] : NODE_WIDTH;
  const childrenMid = (first + last + lastRight) / 2;
  const parentShift = childrenMid - NODE_WIDTH / 2;

  // --- Collect positions (shifted so parent is at dx=0) ---
  const positions: PosEntry[] = [{ node, dx: 0, depth: 0, yOffset: 0 }];

  for (let i = 0; i < childItems.length; i++) {
    const xShift = offsets[i] - parentShift;
    for (const pos of childItems[i].positions) {
      positions.push({
        node: pos.node,
        dx: pos.dx + xShift,
        depth: pos.depth + 1, // children are 1 level below parent
        yOffset: pos.yOffset,
      });
    }
  }

  // --- Build this subtree's contour ---
  const left: number[] = [0];
  const right: number[] = [NODE_WIDTH];

  for (let i = 0; i < childItems.length; i++) {
    const xShift = offsets[i] - parentShift;
    const child = childItems[i];
    for (let d = 0; d < child.left.length; d++) {
      const absD = d + 1;
      const l = child.left[d] + xShift;
      const r = child.right[d] + xShift;
      while (left.length <= absD) { left.push(Infinity); right.push(-Infinity); }
      left[absD] = Math.min(left[absD], l);
      right[absD] = Math.max(right[absD], r);
    }
  }

  // Replace sentinel values for depths that only have one side
  for (let d = 0; d < left.length; d++) {
    if (left[d] === Infinity) left[d] = 0;
    if (right[d] === -Infinity) right[d] = NODE_WIDTH;
  }

  return { left, right, positions };
}

/** Convert subtree layouts into React Flow nodes + edges. */
function layoutTree(roots: TreeNode[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const personMap = new Map<string, TreeNode>();

  // Build parent map for edge creation
  const parentOf = new Map<number, number>();
  function mapParents(n: TreeNode) {
    for (const c of n.children) { parentOf.set(c.id, n.id); mapParents(c); }
  }

  let rootOffsetX = 0;

  for (const root of roots) {
    mapParents(root);
    const result = layoutSubtree(root);

    // Shift so leftmost node starts at rootOffsetX
    let minX = Infinity;
    let maxX = -Infinity;
    for (const p of result.positions) { if (p.dx < minX) minX = p.dx; }

    for (const p of result.positions) {
      const absX = p.dx - minX + rootOffsetX;
      const absY = p.depth * Y_GAP + p.yOffset;

      personMap.set(String(p.node.id), p.node);
      nodes.push({
        id: String(p.node.id),
        type: "person",
        position: { x: absX, y: absY },
        data: {
          name: p.node.name,
          title: p.node.title,
          photoUrl: p.node.photoUrl,
          departmentColor: p.node.department?.color || null,
          isRoot: p.node.id === root.id,
        },
      });

      const pid = parentOf.get(p.node.id);
      if (pid !== undefined) {
        edges.push({
          id: `e-${pid}-${p.node.id}`,
          source: String(pid),
          target: String(p.node.id),
          type: "smoothstep",
          style: EDGE_STYLE,
        });
      }

      if (absX + NODE_WIDTH > maxX) maxX = absX + NODE_WIDTH;
    }

    rootOffsetX = maxX + NODE_WIDTH;
  }

  const activeNodeIds = new Set(nodes.map((node) => node.id));
  const existingEdgeIds = new Set(edges.map((edge) => `${edge.source}-${edge.target}`));
  for (const person of personMap.values()) {
    for (const secondaryParentId of person.secondaryReportsTo ?? []) {
      const source = String(secondaryParentId);
      const target = String(person.id);
      if (
        source === target ||
        person.reportsTo === secondaryParentId ||
        !activeNodeIds.has(source) ||
        !activeNodeIds.has(target) ||
        existingEdgeIds.has(`${source}-${target}`)
      ) {
        continue;
      }

      edges.push({
        id: `secondary-${source}-${target}`,
        source,
        target,
        type: "smoothstep",
        style: SECONDARY_EDGE_STYLE,
        className: "secondary-reporting-edge",
      });
      existingEdgeIds.add(`${source}-${target}`);
    }
  }

  return { nodes, edges, personMap };
}

export function TopDownTree({
  tree,
  onNodeClick,
  onInit,
  onBackgroundContextMenu,
  selectedNodeIds,
  highlightedNodeId,
}: Props) {
  const { nodes: initialNodes, edges: initialEdges, personMap } = useMemo(
    () => layoutTree(tree),
    [tree]
  );

  const translateExtent = useMemo(() => computeTranslateExtent(initialNodes), [initialNodes]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [animating, setAnimating] = useState(false);
  const mountedRef = useRef(false);
  const { handleNodeMouseEnter, handleNodeMouseLeave, applyToNodes, applyToEdges } = usePathHighlight(tree, selectedNodeIds);

  // Sync nodes/edges when tree data changes — animate positions after initial mount
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const frame = requestAnimationFrame(() => {
      setAnimating(true);
      setNodes(initialNodes);
      setEdges(initialEdges);
    });
    const timer = setTimeout(() => setAnimating(false), 400);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Update node highlight when highlightedNodeId changes
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...n.data,
          highlighted: n.id === String(highlightedNodeId),
        },
      }))
    );
  }, [highlightedNodeId, setNodes]);

  // Path highlighting on hover
  useEffect(() => {
    setNodes((prev) => applyToNodes(prev));
    setEdges((prev) => applyToEdges(prev));
  }, [applyToNodes, applyToEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setContextMenu(null);
      const person = personMap.get(node.id);
      if (person) onNodeClick(person);
    },
    [personMap, onNodeClick]
  );

  // Right-click context menu
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      const person = personMap.get(node.id);
      if (!person) return;

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        person,
      });
    },
    [personMap]
  );

  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      setContextMenu(null);
      onBackgroundContextMenu?.(event.clientX, event.clientY);
    },
    [onBackgroundContextMenu]
  );

  return (
    <ReactFlowProvider>
      <div className="relative h-full w-full">
        <ChartBackgroundDecor />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onNodeContextMenu={handleNodeContextMenu}
          onPaneContextMenu={handlePaneContextMenu}
          onInit={onInit}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          panOnDrag
          selectionOnDrag={false}
          fitView
          zoomOnDoubleClick={false}
          fitViewOptions={{ padding: 0.35, maxZoom: 1.5 }}
          translateExtent={translateExtent}
          proOptions={{ hideAttribution: true }}
          className={cn(
            "relative z-10 bg-transparent",
            animating && "[&_.react-flow__node]:transition-transform [&_.react-flow__node]:duration-300 [&_.react-flow__node]:ease-out"
          )}
        >
          <CollapsibleMinimap />
        </ReactFlow>

        {contextMenu && (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            person={contextMenu.person}
            onClose={() => setContextMenu(null)}
            onEdit={() => { onNodeClick(contextMenu.person); setContextMenu(null); }}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
}
