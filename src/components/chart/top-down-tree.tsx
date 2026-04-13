"use client";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PersonNode } from "./person-node";
import { NodeContextMenu } from "./node-context-menu";
import type { TreeNode } from "@/types";

const X_GAP = 200;
const Y_GAP = 120;
const DROP_RADIUS = 80;

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
  onDrop?: (personId: number, targetId: number) => void;
  onToggle?: (personId: number) => void;
  onDelete?: (personId: number, personName: string) => void;
  highlightedNodeId?: number | null;
}

/** Recursively compute subtree width (number of leaf-equivalent slots). */
function getSubtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce(
    (sum, child) => sum + getSubtreeWidth(child),
    0
  );
}

/** Flatten tree into React Flow nodes and edges with computed positions. */
function layoutTree(roots: TreeNode[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Map from person id to TreeNode for click lookups
  const personMap = new Map<string, TreeNode>();

  function traverse(node: TreeNode, x: number, y: number, isRoot: boolean) {
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

    if (node.children.length === 0) return;

    const totalWidth = getSubtreeWidth(node);
    let offsetX = x - ((totalWidth - 1) * X_GAP) / 2;

    for (const child of node.children) {
      const childWidth = getSubtreeWidth(child);
      const childX = offsetX + ((childWidth - 1) * X_GAP) / 2;
      const childY = y + Y_GAP;

      edges.push({
        id: `e-${node.id}-${child.id}`,
        source: nodeId,
        target: String(child.id),
        type: "smoothstep",
        style: { stroke: "hsl(209, 60%, 50%)", strokeWidth: 2 },
      });

      traverse(child, childX, childY, false);
      offsetX += childWidth * X_GAP;
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
  onDrop,
  onToggle,
  onDelete,
  highlightedNodeId,
}: Props) {
  const { nodes: initialNodes, edges: initialEdges, personMap } = useMemo(
    () => layoutTree(tree),
    [tree]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Sync nodes/edges when tree data changes (e.g. after undo/redo refetch)
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Close context menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as HTMLElement)
      ) {
        setContextMenu(null);
      }
    }
    if (contextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [contextMenu]);

  // Close context menu on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setContextMenu(null);
    }
    if (contextMenu) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [contextMenu]);

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

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setContextMenu(null);
      const person = personMap.get(node.id);
      if (person) onNodeClick(person);
    },
    [personMap, onNodeClick]
  );

  // Save position when drag starts so we can snap back if needed
  const handleNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      dragStartPosRef.current = { ...node.position };
    },
    []
  );

  // Drag-to-edit: when a node is dropped near another node, call onDrop
  // Otherwise snap the node back to its original position
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      const draggedId = draggedNode.id;

      if (!isEditor || !onDrop) {
        // Snap back — dragging not supported in this mode
        if (dragStartPosRef.current) {
          const pos = dragStartPosRef.current;
          setNodes((prev) => prev.map((n) => n.id === draggedId ? { ...n, position: pos } : n));
        }
        dragStartPosRef.current = null;
        return;
      }

      const draggedPos = draggedNode.position;

      // Approximate center of the dragged node (node is ~160px wide, ~60px tall)
      const draggedCenterX = draggedPos.x + 80;
      const draggedCenterY = draggedPos.y + 30;

      let closestId: string | null = null;
      let closestDist = Infinity;

      for (const node of nodes) {
        if (node.id === draggedId) continue;

        const nodeCenterX = node.position.x + 80;
        const nodeCenterY = node.position.y + 30;

        const dx = draggedCenterX - nodeCenterX;
        const dy = draggedCenterY - nodeCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < closestDist) {
          closestDist = dist;
          closestId = node.id;
        }
      }

      if (closestId && closestDist <= DROP_RADIUS) {
        onDrop(Number(draggedId), Number(closestId));
      } else {
        // No valid drop target — snap back to original position
        if (dragStartPosRef.current) {
          const pos = dragStartPosRef.current;
          setNodes((prev) => prev.map((n) => n.id === draggedId ? { ...n, position: pos } : n));
        }
      }
      dragStartPosRef.current = null;
    },
    [isEditor, onDrop, nodes, setNodes]
  );

  // Right-click context menu
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (!isEditor) return;
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
    [isEditor, personMap]
  );

  const handleContextEdit = useCallback(() => {
    if (!contextMenu) return;
    // Open the person detail panel via onNodeClick
    onNodeClick(contextMenu.person);
    setContextMenu(null);
  }, [contextMenu, onNodeClick]);

  const handleContextToggle = useCallback(() => {
    if (!contextMenu || !onToggle) return;
    onToggle(contextMenu.person.id);
    setContextMenu(null);
  }, [contextMenu, onToggle]);

  const handleContextDelete = useCallback(() => {
    if (!contextMenu || !onDelete) return;
    onDelete(contextMenu.person.id, contextMenu.person.name);
    setContextMenu(null);
  }, [contextMenu, onDelete]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onNodeContextMenu={handleNodeContextMenu}
        onInit={onInit}
        nodeTypes={nodeTypes}
        nodesDraggable={isEditor}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      />

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[160px] rounded-lg border border-border bg-card shadow-xl py-1 animate-in fade-in zoom-in-95"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="px-3 py-1.5 border-b border-border">
            <p className="text-xs text-muted-foreground truncate">
              {contextMenu.person.name}
            </p>
          </div>
          <button
            onClick={handleContextEdit}
            className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
          >
            Edit Details
          </button>
          <button
            onClick={handleContextToggle}
            className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
          >
            {contextMenu.person.isActive ? "Deactivate" : "Activate"}
          </button>
          <div className="border-t border-border my-0.5" />
          <button
            onClick={handleContextDelete}
            className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
