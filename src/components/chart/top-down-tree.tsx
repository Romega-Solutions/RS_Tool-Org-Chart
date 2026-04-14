"use client";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  ReactFlow,
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
import type { TreeNode } from "@/types";

const X_GAP = 148;
const Y_GAP = 140;
const GRID_X_GAP = 142;
const GRID_Y_GAP = 136;
const DROP_RADIUS = 130;
const NODE_WIDTH = 128;
const NODE_HEIGHT = 90;
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
}

/** How many columns a leaf grid should use — ceil(sqrt(n)) for a compact rectangle. */
function getLeafCols(leafCount: number): number {
  if (leafCount <= 1) return 1;
  return Math.ceil(Math.sqrt(leafCount));
}

/** Recursively compute subtree width (number of leaf-equivalent slots).
 *  Leaf children are arranged in a grid whose column count adapts to the group size. */
function getSubtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) return 1;

  const leaves = node.children.filter((c) => c.children.length === 0);
  const branches = node.children.filter((c) => c.children.length > 0);

  // Grid layout when there are 2+ leaf children
  if (leaves.length >= 2) {
    const branchWidth = branches.reduce((sum, b) => sum + getSubtreeWidth(b), 0);
    return branchWidth + getLeafCols(leaves.length);
  }

  // Otherwise every child gets its own horizontal slot
  return node.children.reduce((sum, c) => sum + getSubtreeWidth(c), 0);
}

/** Flatten tree into React Flow nodes and edges with computed positions. */
function layoutTree(roots: TreeNode[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Map from person id to TreeNode for click lookups
  const personMap = new Map<string, TreeNode>();

  function pushPerson(
    node: TreeNode,
    x: number,
    y: number,
    isRoot: boolean,
    parentId?: string
  ) {
    const nodeId = String(node.id);
    personMap.set(nodeId, node);

    nodes.push({
      id: nodeId,
      type: "person",
      position: { x, y },
      data: {
        name: node.name,
        title: node.title,
        photoUrl: node.photoUrl,
        departmentColor: node.department?.color || null,
        isRoot,
      },
    });

    if (parentId) {
      edges.push({
        id: `e-${parentId}-${node.id}`,
        source: parentId,
        target: nodeId,
        type: "smoothstep",
        style: EDGE_STYLE,
      });
    }
  }

  function traverse(node: TreeNode, x: number, y: number, isRoot: boolean, parentId?: string) {
    pushPerson(node, x, y, isRoot, parentId);

    if (node.children.length === 0) return;

    const nodeId = String(node.id);
    const leaves = node.children.filter((c) => c.children.length === 0);
    const branches = node.children.filter((c) => c.children.length > 0);
    const stackLeaves = leaves.length >= 2;

    if (!stackLeaves) {
      // All children laid out horizontally (standard behaviour)
      const totalWidth = getSubtreeWidth(node);
      let offsetX = x - ((totalWidth - 1) * X_GAP) / 2;

      for (const child of node.children) {
        const childWidth = getSubtreeWidth(child);
        const childX = offsetX + ((childWidth - 1) * X_GAP) / 2;
        traverse(child, childX, y + Y_GAP, false, nodeId);
        offsetX += childWidth * X_GAP;
      }
      return;
    }

    // Hybrid layout: branches spread horizontally, leaves stacked vertically
    const totalWidth = getSubtreeWidth(node);
    let offsetX = x - ((totalWidth - 1) * X_GAP) / 2;

    // 1) Spread branches
    for (const branch of branches) {
      const bw = getSubtreeWidth(branch);
      const bx = offsetX + ((bw - 1) * X_GAP) / 2;
      traverse(branch, bx, y + Y_GAP, false, nodeId);
      offsetX += bw * X_GAP;
    }

    // 2) Arrange leaves in a compact grid
    const cols = getLeafCols(leaves.length);
    const leafBaseX = offsetX;
    for (let i = 0; i < leaves.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const leafX = leafBaseX + col * GRID_X_GAP;
      const leafY = y + Y_GAP + row * GRID_Y_GAP;
      pushPerson(leaves[i], leafX, leafY, false, nodeId);
    }
  }

  // Layout multiple roots side by side
  let rootOffset = 0;
  for (const root of roots) {
    const rootWidth = getSubtreeWidth(root);
    const rootX = rootOffset + ((rootWidth - 1) * X_GAP) / 2;
    traverse(root, rootX, 0, true);
    rootOffset += rootWidth * X_GAP;
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
}: Props) {
  const { nodes: initialNodes, edges: initialEdges, personMap } = useMemo(
    () => layoutTree(tree),
    [tree]
  );

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

  // Move all descendants along with the dragged node
  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      const startPos = dragStartRef.current;
      if (!startPos) return;

      const descendants = descendantsMap.get(draggedNode.id);
      if (!descendants || descendants.length === 0) return;

      const dx = draggedNode.position.x - startPos.x;
      const dy = draggedNode.position.y - startPos.y;
      const ddx = dx - lastDeltaRef.current.x;
      const ddy = dy - lastDeltaRef.current.y;

      if (ddx === 0 && ddy === 0) return;
      lastDeltaRef.current = { x: dx, y: dy };

      const descSet = new Set(descendants);
      setNodes((prev) =>
        prev.map((n) =>
          descSet.has(n.id)
            ? { ...n, position: { x: n.position.x + ddx, y: n.position.y + ddy } }
            : n
        )
      );
    },
    [descendantsMap, setNodes]
  );

  // Drag-to-edit: when a node is dropped near another node, reassign reporting line
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      dragStartRef.current = null;
      lastDeltaRef.current = { x: 0, y: 0 };

      if (!isEditor || !onDrop) return;

      const draggedId = draggedNode.id;
      const descendants = descendantsMap.get(draggedId) || [];
      const excludeSet = new Set([draggedId, ...descendants]);

      const draggedCenterX = draggedNode.position.x + NODE_WIDTH / 2;
      const draggedCenterY = draggedNode.position.y + NODE_HEIGHT / 2;

      let closestId: string | null = null;
      let closestDist = Infinity;

      for (const node of nodes) {
        // Skip self and own descendants
        if (excludeSet.has(node.id)) continue;
        const dx = draggedCenterX - (node.position.x + NODE_WIDTH / 2);
        const dy = draggedCenterY - (node.position.y + NODE_HEIGHT / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = node.id;
        }
      }

      if (closestId && closestDist <= DROP_RADIUS) {
        onDrop(Number(draggedId), Number(closestId));
      } else {
        onDragMiss?.();
      }
    },
    [isEditor, onDrop, onDragMiss, descendantsMap, nodes]
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
        fitViewOptions={{ padding: 0.35, maxZoom: 1.5 }}
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
  );
}
