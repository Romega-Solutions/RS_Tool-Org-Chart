"use client";
import { useMemo, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getDeptIcon } from "@/lib/dept-icons";
import { NodeContextMenu } from "./node-context-menu";
import type { TreeNode, Department } from "@/types";

interface Props {
  tree: TreeNode[];
  departments: Department[];
  isEditor?: boolean;
  onNodeClick: (person: TreeNode) => void;
  onBackgroundContextMenu?: (x: number, y: number) => void;
  onToggle?: (personId: number) => void;
  onDelete?: (personId: number, personName: string) => void;
  highlightedNodeId?: number | null;
}

/** Flatten all tree nodes into a flat list. */
function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  function walk(node: TreeNode) {
    result.push(node);
    for (const child of node.children) walk(child);
  }
  for (const root of nodes) walk(root);
  return result;
}

export function DepartmentGrid({ tree, departments, onNodeClick, onBackgroundContextMenu, onToggle, onDelete, highlightedNodeId }: Props) {
  const grouped = useMemo(() => {
    const all = flattenTree(tree);
    const map = new Map<number, { department: Department; people: TreeNode[] }>();

    for (const dept of departments) {
      map.set(dept.id, { department: dept, people: [] });
    }

    for (const person of all) {
      const group = map.get(person.departmentId);
      if (group) {
        group.people.push(person);
      }
    }

    // Return only departments that have people
    return Array.from(map.values()).filter((g) => g.people.length > 0);
  }, [tree, departments]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; person: TreeNode } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, person: TreeNode) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, person });
    },
    []
  );

  const handleBackgroundContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("[data-person-card='true']")) return;
      e.preventDefault();
      setContextMenu(null);
      onBackgroundContextMenu?.(e.clientX, e.clientY);
    },
    [onBackgroundContextMenu]
  );

  return (
    <div
      className="h-full overflow-y-auto bg-background p-6"
      onContextMenu={handleBackgroundContextMenu}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {grouped.map(({ department, people }) => {
          const DeptIcon = getDeptIcon(department.name);
          return (
          <div
            key={department.id}
            className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md hover:border-primary/30 transition-all duration-200"
          >
            {/* Department header */}
            <div
              className="px-4 py-3 border-b border-border flex items-center gap-2"
              style={{
                borderLeftWidth: 3,
                borderLeftColor: department.color || "hsl(209,50%,25%)",
              }}
            >
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `${department.color || "hsl(209,50%,25%)"}20`,
                }}
              >
                <DeptIcon
                  className="w-3 h-3"
                  style={{ color: department.color || "hsl(209,50%,25%)" }}
                />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {department.name}
              </h3>
              <span className="text-xs text-muted-foreground ml-auto">
                {people.length}
              </span>
            </div>

            {/* People list */}
            <div className="p-2 space-y-1">
              {people.map((person) => {
                const initials = person.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <button
                    key={person.id}
                    id={`person-card-${person.id}`}
                    data-person-card="true"
                    onClick={() => { setContextMenu(null); onNodeClick(person); }}
                    onContextMenu={(e) => handleContextMenu(e, person)}
                    className={cn(
                      "w-full flex items-center gap-2.5 p-2 rounded-md hover:bg-muted cursor-pointer transition-all duration-200 text-left",
                      highlightedNodeId === person.id && "ring-2 ring-rs-primary-500 bg-rs-primary-500/10 shadow-sm"
                    )}
                  >
                    <Avatar className="w-8 h-8">
                      {person.photoUrl && (
                        <AvatarImage src={person.photoUrl} />
                      )}
                      <AvatarFallback className="bg-rs-primary-500/10 text-rs-primary-400 text-[10px]">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {person.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {person.title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          );
        })}
      </div>

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
