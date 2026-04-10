"use client";
import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TreeNode, Department } from "@/types";

interface Props {
  tree: TreeNode[];
  departments: Department[];
  onNodeClick: (person: TreeNode) => void;
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

export function DepartmentGrid({ tree, departments, onNodeClick }: Props) {
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

  return (
    <div className="h-full overflow-y-auto p-6 bg-rs-neutral-950">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {grouped.map(({ department, people }) => (
          <div
            key={department.id}
            className="bg-rs-neutral-900 border border-rs-neutral-800 rounded-lg overflow-hidden"
          >
            {/* Department header */}
            <div
              className="px-4 py-3 border-b border-rs-neutral-800 flex items-center gap-2"
              style={{
                borderLeftWidth: 3,
                borderLeftColor: department.color || "hsl(209,50%,25%)",
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: department.color || "hsl(209,50%,25%)",
                }}
              />
              <h3 className="text-sm font-semibold text-rs-neutral-100">
                {department.name}
              </h3>
              <span className="text-xs text-rs-neutral-500 ml-auto">
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
                    onClick={() => onNodeClick(person)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-md hover:bg-rs-neutral-800 transition-colors text-left"
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
                      <p className="text-xs font-medium text-rs-neutral-200 truncate">
                        {person.name}
                      </p>
                      <p className="text-[10px] text-rs-neutral-500 truncate">
                        {person.title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
