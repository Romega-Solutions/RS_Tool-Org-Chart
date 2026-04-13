"use client";
import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { HorizontalPersonNode } from "./horizontal-person-node";
import type { TreeNode } from "@/types";

const X_GAP = 250;
const Y_GAP = 100;

interface Props {
  tree: TreeNode[];
  isEditor: boolean;
  onNodeClick: (person: TreeNode) => void;
  onInit?: (instance: ReactFlowInstance) => void;
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
        style: { stroke: "hsl(209, 60%, 50%)", strokeWidth: 2 },
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

export function HorizontalTree({ tree, isEditor, onNodeClick, onInit, highlightedNodeId }: Props) {
  const {
    nodes: initialNodes,
    edges: initialEdges,
    personMap,
  } = useMemo(() => layoutTree(tree), [tree]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes/edges when tree data changes (e.g. after undo/redo refetch)
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
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

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const person = personMap.get(node.id);
      if (person) onNodeClick(person);
    },
    [personMap, onNodeClick]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onInit={onInit}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      className="bg-background"
    />
  );
}
