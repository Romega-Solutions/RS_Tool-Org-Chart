"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ChartBackgroundDecor } from "./chart-background-decor";
import { HorizontalPersonNode } from "./horizontal-person-node";
import { NodeContextMenu } from "./node-context-menu";
import { CollapsibleMinimap } from "./collapsible-minimap";
import { usePathHighlight } from "@/hooks/use-path-highlight";
import type { TreeNode } from "@/types";

const X_GAP = 250;
const Y_GAP = 100;
const EDGE_STYLE = {
  stroke: "var(--chart-edge-stroke)",
  strokeWidth: 1.5,
  opacity: 0.9,
};

interface Props {
  tree: TreeNode[];
  isEditor: boolean;
  onNodeClick: (person: TreeNode) => void;
  onInit?: (instance: ReactFlowInstance) => void;
  onBackgroundContextMenu?: (x: number, y: number) => void;
  onToggle?: (personId: number) => void;
  onDelete?: (personId: number, personName: string) => void;
  onSelectionChange?: (nodeIds: number[]) => void;
  selectedNodeIds?: number[];
  highlightedNodeId?: number | null;
}

const nodeTypes = { person: HorizontalPersonNode };

/** Recursively compute subtree height (number of leaf-equivalent slots). */
function getSubtreeHeight(node: TreeNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce(
    (sum, child) => sum + getSubtreeHeight(child),
    0
  );
}

/** Flatten tree into React Flow nodes and edges with left-to-right positions. */
function layoutTree(roots: TreeNode[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const personMap = new Map<string, TreeNode>();

  function traverse(
    node: TreeNode,
    depth: number,
    ySlotStart: number,
    isRoot: boolean
  ) {
    const nodeId = String(node.id);
    personMap.set(nodeId, node);

    const size = getSubtreeHeight(node);
    // Centre this node within its allocated Y-slot range
    const yCentre = (ySlotStart + (size - 1) / 2) * Y_GAP;

    nodes.push({
      id: nodeId,
      type: "person",
      position: { x: depth * X_GAP, y: yCentre },
      data: {
        name: node.name,
        title: node.title,
        photoUrl: node.photoUrl,
        departmentColor: node.department?.color || null,
        isRoot,
      },
    });

    if (node.children.length === 0) return;

    let childSlotStart = ySlotStart;
    for (const child of node.children) {
      edges.push({
        id: `e-${node.id}-${child.id}`,
        source: nodeId,
        target: String(child.id),
        type: "smoothstep",
        style: EDGE_STYLE,
      });
      traverse(child, depth + 1, childSlotStart, false);
      childSlotStart += getSubtreeHeight(child);
    }
  }

  // Layout multiple roots stacked vertically
  let rootSlotStart = 0;
  for (const root of roots) {
    traverse(root, 0, rootSlotStart, true);
    rootSlotStart += getSubtreeHeight(root);
  }

  return { nodes, edges, personMap };
}

export function HorizontalTree({ tree, onNodeClick, onInit, onBackgroundContextMenu, onToggle, onDelete, onSelectionChange, selectedNodeIds, highlightedNodeId }: Props) {
  const {
    nodes: initialNodes,
    edges: initialEdges,
    personMap,
  } = useMemo(() => layoutTree(tree), [tree]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [animating, setAnimating] = useState(false);
  const mountedRef = useRef(false);
  const { handleNodeMouseEnter, handleNodeMouseLeave, applyToNodes, applyToEdges } = usePathHighlight(tree, selectedNodeIds);

  // Sync nodes/edges when tree data changes — animate after initial mount
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

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; person: TreeNode } | null>(null);

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

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      const person = personMap.get(node.id);
      if (!person) return;
      setContextMenu({ x: event.clientX, y: event.clientY, person });
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
        onNodeContextMenu={handleNodeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        onSelectionChange={handleSelectionChange}
        onInit={onInit}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
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
