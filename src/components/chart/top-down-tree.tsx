"use client";
import { useCallback, useMemo } from "react";
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
import type { TreeNode } from "@/types";

const X_GAP = 200;
const Y_GAP = 120;

const nodeTypes = { person: PersonNode };

interface Props {
  tree: TreeNode[];
  isEditor: boolean;
  onNodeClick: (person: TreeNode) => void;
  onInit?: (instance: ReactFlowInstance) => void;
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
        style: { stroke: "hsl(209, 50%, 25%)", strokeWidth: 2 },
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

export function TopDownTree({ tree, isEditor, onNodeClick, onInit }: Props) {
  const { nodes: initialNodes, edges: initialEdges, personMap } = useMemo(
    () => layoutTree(tree),
    [tree]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

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
      nodesDraggable={isEditor}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      className="bg-rs-neutral-950"
    />
  );
}
