"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  MiniMap,
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
import { cn } from "@/lib/utils";
import { ChartBackgroundDecor } from "./chart-background-decor";
import { usePathHighlight } from "@/hooks/use-path-highlight";
import { NodeContextMenu } from "./node-context-menu";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { TreeNode } from "@/types";

const X_GAP = 200;
const Y_GAP = 120;
const EDGE_STYLE = {
  stroke: "var(--chart-edge-stroke)",
  strokeWidth: 1.5,
  opacity: 0.9,
};

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
  highlighted?: boolean;
  pathHighlighted?: boolean;
  dimmed?: boolean;
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
    highlighted,
    pathHighlighted,
    dimmed,
  } = data;

  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={cn("relative transition-all duration-200", dimmed && "opacity-30 scale-[0.97]")}>
      <div
        className={cn(
          "pointer-events-none absolute inset-x-4 -bottom-3 h-6 rounded-full bg-rs-neutral-900/12 blur-md transition-all duration-200 dark:bg-black/35",
          (highlighted || pathHighlighted) && "bg-rs-primary-500/18 dark:bg-rs-primary-400/20"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-[-7px] rounded-[1.05rem] bg-white/72 opacity-85 blur-lg transition-all duration-200 dark:bg-white/[0.03] dark:opacity-100",
          highlighted && "bg-rs-primary-500/8 dark:bg-rs-primary-400/10"
        )}
      />
      <div
        className={cn(
          "relative bg-card/98 backdrop-blur-[2px] border border-white/70 rounded-lg p-3 min-w-[160px] shadow-[0_18px_40px_rgba(15,23,42,0.10),0_2px_0_rgba(255,255,255,0.65)_inset] hover:shadow-[0_24px_55px_rgba(15,23,42,0.14),0_2px_0_rgba(255,255,255,0.75)_inset] hover:border-rs-primary-300 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer dark:border-border dark:shadow-[0_20px_45px_rgba(0,0,0,0.34)] dark:hover:shadow-[0_24px_55px_rgba(0,0,0,0.42)]",
          highlighted && "ring-2 ring-rs-primary-500 shadow-[0_26px_60px_rgba(0,112,224,0.18),0_2px_0_rgba(255,255,255,0.8)_inset] border-rs-primary-300 -translate-y-0.5 dark:shadow-[0_28px_60px_rgba(14,165,233,0.18)]",
          pathHighlighted && "border-rs-primary-400 shadow-[0_24px_55px_rgba(0,112,224,0.12),0_2px_0_rgba(255,255,255,0.75)_inset] -translate-y-0.5 dark:border-rs-primary-500 dark:shadow-[0_24px_55px_rgba(14,165,233,0.14)]"
        )}
        style={{
          borderLeftColor: departmentColor || undefined,
          borderLeftWidth: 3,
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/75 via-white/28 to-transparent dark:from-white/[0.06] dark:via-transparent dark:to-transparent" />
        {!isRoot && (
          <Handle
            type="target"
            position={Position.Top}
            className="!bg-rs-primary-500 !w-2 !h-2"
          />
        )}
        <div className="relative flex items-center gap-3">
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
        style: EDGE_STYLE,
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
  onBackgroundContextMenu?: (x: number, y: number) => void;
  onToggle?: (personId: number) => void;
  onDelete?: (personId: number, personName: string) => void;
  onSelectionChange?: (nodeIds: number[]) => void;
  selectedNodeIds?: number[];
  highlightedNodeId?: number | null;
}

const nodeTypes = { person: CollapsiblePersonNode };

export function CollapsibleTree({ tree, onNodeClick, onInit, onBackgroundContextMenu, onToggle, onDelete, onSelectionChange, selectedNodeIds, highlightedNodeId }: Props) {
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
  const [animating, setAnimating] = useState(false);
  const mountedRef = useRef(false);
  const { handleNodeMouseEnter, handleNodeMouseLeave, applyToNodes, applyToEdges } = usePathHighlight(tree, selectedNodeIds);

  // Re-sync when tree data or collapsed set changes — animate after initial mount
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setNodes(layoutNodes);
      setEdges(layoutEdges);
      return;
    }
    setAnimating(true);
    setNodes(layoutNodes);
    setEdges(layoutEdges);
    const timer = setTimeout(() => setAnimating(false), 400);
    return () => clearTimeout(timer);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

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
        selectionMode={"partial" as const}
        selectionKeyCode="Shift"
        fitView
        fitViewOptions={{ padding: 0.35, maxZoom: 1.5 }}
        proOptions={{ hideAttribution: true }}
        className={cn(
          "relative z-10 bg-transparent",
          animating && "[&_.react-flow__node]:transition-transform [&_.react-flow__node]:duration-300 [&_.react-flow__node]:ease-out"
        )}
      >
        <MiniMap
          pannable
          zoomable
          className="!bg-card/80 !border-border !rounded-lg !shadow-md"
          maskColor="rgba(0,0,0,0.08)"
          nodeColor={(n) => (n.data?.departmentColor as string) || "hsl(209, 60%, 50%)"}
        />
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
