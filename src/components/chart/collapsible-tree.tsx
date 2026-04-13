"use client";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { TreeNode } from "@/types";

const X_GAP = 200;
const Y_GAP = 120;

/* -------------------------------------------------------------------------- */
/*  Collapsible Person Node                                                   */
/* -------------------------------------------------------------------------- */

interface CollapsibleNodeData extends Record<string, unknown> {
  name: string;
  title: string;
  photoUrl: string | null;
  departmentColor: string | null;
  isRoot: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  childCount: number;
  onToggle: (nodeId: string) => void;
  nodeId: string;
}

function CollapsiblePersonNodeComponent({
  data,
}: {
  data: CollapsibleNodeData;
}) {
  const {
    name,
    title,
    photoUrl,
    departmentColor,
    isRoot,
    hasChildren,
    isCollapsed,
    childCount,
    onToggle,
    nodeId,
  } = data;

  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative">
      <div
        className="bg-card border border-border rounded-lg p-3 min-w-[160px] shadow-lg hover:shadow-xl hover:border-rs-primary-400 hover:scale-[1.02] transition-all duration-200 cursor-pointer"
        style={{
          borderLeftColor: departmentColor || undefined,
          borderLeftWidth: 3,
        }}
      >
        {!isRoot && (
          <Handle
            type="target"
            position={Position.Top}
            className="!bg-rs-primary-500 !w-2 !h-2"
          />
        )}
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            {photoUrl && <AvatarImage src={photoUrl} />}
            <AvatarFallback className="bg-rs-primary-500/20 text-rs-primary-400 text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-sm text-foreground truncate">
              {name}
            </p>
            <p className="text-xs text-muted-foreground truncate">{title}</p>
          </div>
        </div>
        {hasChildren && (
          <Handle
            type="source"
            position={Position.Bottom}
            className="!bg-rs-primary-500 !w-2 !h-2"
          />
        )}
      </div>

      {/* Collapse / expand toggle button */}
      {hasChildren && (
        <button
          type="button"
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-muted border border-border hover:border-rs-primary-400 hover:bg-secondary cursor-pointer transition-all duration-200"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(nodeId);
          }}
          title={
            isCollapsed
              ? `Expand ${childCount} direct report${childCount !== 1 ? "s" : ""}`
              : "Collapse"
          }
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
      )}
    </div>
  );
}

const CollapsiblePersonNode = memo(CollapsiblePersonNodeComponent);

/* -------------------------------------------------------------------------- */
/*  Layout helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Subtree width honouring collapsed state: collapsed nodes count as 1 slot. */
function getSubtreeWidth(node: TreeNode, collapsed: Set<number>): number {
  if (node.children.length === 0 || collapsed.has(node.id)) return 1;
  return node.children.reduce(
    (sum, child) => sum + getSubtreeWidth(child, collapsed),
    0
  );
}

/** Flatten tree into React Flow nodes & edges, skipping children of collapsed nodes. */
function layoutTree(
  roots: TreeNode[],
  collapsed: Set<number>,
  onToggle: (nodeId: string) => void
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const personMap = new Map<string, TreeNode>();

  function traverse(node: TreeNode, x: number, y: number, isRoot: boolean) {
    const nodeId = String(node.id);
    const isCollapsed = collapsed.has(node.id);
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
        hasChildren: node.children.length > 0,
        isCollapsed,
        childCount: node.children.length,
        onToggle,
        nodeId,
      } satisfies CollapsibleNodeData,
    });

    // If collapsed or no children, stop here
    if (isCollapsed || node.children.length === 0) return;

    const totalWidth = getSubtreeWidth(node, collapsed);
    let offsetX = x - ((totalWidth - 1) * X_GAP) / 2;

    for (const child of node.children) {
      const childWidth = getSubtreeWidth(child, collapsed);
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
    const rootWidth = getSubtreeWidth(root, collapsed);
    const rootX = rootOffset + ((rootWidth - 1) * X_GAP) / 2;
    traverse(root, rootX, 0, true);
    rootOffset += rootWidth * X_GAP;
  }

  return { nodes, edges, personMap };
}

/* -------------------------------------------------------------------------- */
/*  Collapsible Tree Component                                                */
/* -------------------------------------------------------------------------- */

interface Props {
  tree: TreeNode[];
  isEditor: boolean;
  onNodeClick: (person: TreeNode) => void;
  onInit?: (instance: ReactFlowInstance) => void;
}

const nodeTypes = { person: CollapsiblePersonNode };

export function CollapsibleTree({ tree, isEditor, onNodeClick, onInit }: Props) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const handleToggle = useCallback((nodeId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      const id = Number(nodeId);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const {
    nodes: layoutNodes,
    edges: layoutEdges,
    personMap,
  } = useMemo(
    () => layoutTree(tree, collapsed, handleToggle),
    [tree, collapsed, handleToggle]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  // Re-sync when tree data or collapsed set changes (useMemo gives new layout,
  // but useNodesState only uses the initial value — we must push updates).
  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

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
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      className="bg-background"
    />
  );
}
