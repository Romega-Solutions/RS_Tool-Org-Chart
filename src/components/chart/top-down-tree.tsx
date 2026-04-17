"use client";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
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
const GRID_X_GAP = 142;
const GRID_ROW_GAP = 128;
const NODE_GAP = 22;
const DROP_RADIUS = 130;
const NODE_WIDTH = 160;
const NODE_HEIGHT = 90;

type DropResult = {
  id: string;
  intent: "reassign" | "reorder-before" | "reorder-after";
} | null;

const EDGE_STYLE = {
  stroke: "var(--chart-edge-stroke)",
  strokeWidth: 1.5,
  opacity: 0.9,
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
  isEditor: boolean;
  onNodeClick: (person: TreeNode) => void;
  onInit?: (instance: ReactFlowInstance) => void;
  onBackgroundContextMenu?: (x: number, y: number) => void;
  onDragMiss?: () => void;
  onDrop?: (personId: number, targetId: number) => void;
  onToggle?: (personId: number) => void;
  onDelete?: (personId: number, personName: string) => void;
  onSelectionChange?: (nodeIds: number[]) => void;
  selectedNodeIds?: number[];
  highlightedNodeId?: number | null;
  onCanvasDoubleClick?: () => void;
  onReorder?: (personId: number, siblingId: number, position: "before" | "after") => void;
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

    // Grid occupies 1 contour depth level — use max row width
    let maxRowWidth = 0;
    for (let r = 0; r < rows; r++) {
      const itemsInRow = r < rows - 1 ? cols : allLeaves.length - r * cols;
      maxRowWidth = Math.max(maxRowWidth, (itemsInRow - 1) * GRID_X_GAP + NODE_WIDTH);
    }
    const left = [0];
    const right = [maxRowWidth];

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

  return { nodes, edges, personMap };
}

export function TopDownTree({
  tree,
  isEditor,
  onNodeClick,
  onInit,
  onBackgroundContextMenu,
  onDrop,
  onDragMiss,
  onToggle,
  onDelete,
  onSelectionChange,
  selectedNodeIds,
  highlightedNodeId,
  onCanvasDoubleClick,
  onReorder,
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
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastDeltaRef = useRef({ x: 0, y: 0 });

  // Build a map of each node's descendant IDs for group dragging
  const descendantsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    function collect(node: TreeNode): string[] {
      const ids: string[] = [];
      for (const child of node.children) {
        ids.push(String(child.id));
        ids.push(...collect(child));
      }
      map.set(String(node.id), ids);
      return ids;
    }
    for (const root of tree) collect(root);
    return map;
  }, [tree]);

  // Sync nodes/edges when tree data changes — animate positions after initial mount
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setAnimating(true);
    setNodes(initialNodes);
    setEdges(initialEdges);
    const timer = setTimeout(() => setAnimating(false), 400);
    return () => clearTimeout(timer);
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

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      onSelectionChange?.(selectedNodes.map((n) => Number(n.id)));
    },
    [onSelectionChange]
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setContextMenu(null);
      const person = personMap.get(node.id);
      if (person) onNodeClick(person);
    },
    [personMap, onNodeClick]
  );

  // Save start position for group drag
  const handleNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      dragStartRef.current = { ...node.position };
      lastDeltaRef.current = { x: 0, y: 0 };
    },
    []
  );

  // Find the closest drop target for a dragged node
  const findDropTarget = useCallback(
    (draggedNode: Node): DropResult => {
      if (!isEditor) return null;
      const draggedId = draggedNode.id;
      const descendants = descendantsMap.get(draggedId) || [];
      const excludeSet = new Set([draggedId, ...descendants]);

      const cx = draggedNode.position.x + NODE_WIDTH / 2;
      const cy = draggedNode.position.y + NODE_HEIGHT / 2;

      let closestNode: Node | null = null;
      let closestDist = Infinity;

      for (const node of nodes) {
        if (excludeSet.has(node.id)) continue;
        const dx = cx - (node.position.x + NODE_WIDTH / 2);
        const dy = cy - (node.position.y + NODE_HEIGHT / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestNode = node;
        }
      }

      if (!closestNode || closestDist > DROP_RADIUS) return null;

      // Check sibling relationship (same reportsTo = same parent)
      const draggedPerson = personMap.get(draggedId);
      const targetPerson = personMap.get(closestNode.id);

      // null === null: root-level nodes are intentionally treated as siblings
      if (
        draggedPerson &&
        targetPerson &&
        draggedPerson.reportsTo === targetPerson.reportsTo
      ) {
        const draggedCX = draggedNode.position.x + NODE_WIDTH / 2;
        const targetCX = closestNode.position.x + NODE_WIDTH / 2;
        const intent =
          draggedCX < targetCX ? "reorder-before" : "reorder-after";
        return { id: closestNode.id, intent };
      }

      return { id: closestNode.id, intent: "reassign" };
    },
    [isEditor, descendantsMap, nodes, personMap]
  );

  // Move all descendants along with the dragged node + show drop target preview
  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      const startPos = dragStartRef.current;
      if (!startPos) return;

      const descendants = descendantsMap.get(draggedNode.id);

      const dx = draggedNode.position.x - startPos.x;
      const dy = draggedNode.position.y - startPos.y;
      const ddx = dx - lastDeltaRef.current.x;
      const ddy = dy - lastDeltaRef.current.y;
      lastDeltaRef.current = { x: dx, y: dy };

      const result = findDropTarget(draggedNode);
      const targetId = result?.id ?? null;
      const targetDropValue: string | boolean = result
        ? result.intent === "reassign"
          ? true
          : result.intent
        : false;

      setNodes((prev) => {
        const descSet = new Set(descendants || []);
        return prev.map((n) => {
          if (descSet.has(n.id) && (ddx !== 0 || ddy !== 0)) {
            return {
              ...n,
              position: { x: n.position.x + ddx, y: n.position.y + ddy },
              data: { ...n.data, dropTarget: false },
            };
          }
          const isTarget = n.id === targetId;
          const newDropValue = isTarget ? targetDropValue : false;
          if (n.data.dropTarget !== newDropValue) {
            return { ...n, data: { ...n.data, dropTarget: newDropValue } };
          }
          return n;
        });
      });
    },
    [descendantsMap, setNodes, findDropTarget]
  );

  // Clear all drop target previews
  const clearDropTargets = useCallback(() => {
    setNodes((prev) =>
      prev.map((n) =>
        n.data.dropTarget ? { ...n, data: { ...n.data, dropTarget: false } } : n
      )
    );
  }, [setNodes]);

  const handlePaneDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditor || !onCanvasDoubleClick) return;
      const target = e.target as HTMLElement;
      if (
        target.closest(".react-flow__node") ||
        target.closest(".react-flow__edge") ||
        target.closest(".react-flow__minimap") ||
        target.closest(".react-flow__controls")
      ) return;
      onCanvasDoubleClick();
    },
    [isEditor, onCanvasDoubleClick]
  );

  // Drag-to-edit: execute the drop and clear preview
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      dragStartRef.current = null;
      lastDeltaRef.current = { x: 0, y: 0 };
      clearDropTargets();

      if (!isEditor) return;

      const result = findDropTarget(draggedNode);

      if (!result) {
        // Snap all nodes back to their computed layout positions (no valid drop target)
        const posMap = new Map(initialNodes.map((n) => [n.id, n.position]));
        setNodes((prev) =>
          prev.map((n) => {
            const pos = posMap.get(n.id);
            return pos && (n.position.x !== pos.x || n.position.y !== pos.y)
              ? { ...n, position: pos }
              : n;
          })
        );
        onDragMiss?.();
        return;
      }

      if (result.intent === "reassign") {
        onDrop?.(Number(draggedNode.id), Number(result.id));
      } else {
        const position =
          result.intent === "reorder-before" ? "before" : "after";
        onReorder?.(Number(draggedNode.id), Number(result.id), position);
      }
    },
    [isEditor, onDrop, onDragMiss, onReorder, findDropTarget, clearDropTargets, initialNodes, setNodes]
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
      <div className="relative h-full w-full" onDoubleClick={handlePaneDoubleClick}>
        <ChartBackgroundDecor />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onNodeContextMenu={handleNodeContextMenu}
          onPaneContextMenu={handlePaneContextMenu}
          onSelectionChange={handleSelectionChange}
          onInit={onInit}
          nodeTypes={nodeTypes}
          nodesDraggable={isEditor}
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          selectionKeyCode="Shift"
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
            onToggle={onToggle ? () => { onToggle(contextMenu.person.id); setContextMenu(null); } : undefined}
            onDelete={onDelete ? () => { onDelete(contextMenu.person.id, contextMenu.person.name); setContextMenu(null); } : undefined}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
}
