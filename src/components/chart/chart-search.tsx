"use client";
import { assetPath } from "@/lib/paths";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDeptIcon } from "@/lib/dept-icons";
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TreeNode, Department } from "@/types";

interface Props {
  tree: TreeNode[];
  departments: Department[];
  onSelect: (person: TreeNode) => void;
}

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  function walk(node: TreeNode) {
    result.push(node);
    for (const child of node.children) walk(child);
  }
  for (const root of nodes) walk(root);
  return result;
}

export function ChartSearch({ tree, departments, onSelect }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const allPeople = useMemo(() => flattenTree(tree), [tree]);

  const grouped = useMemo(() => {
    const map = new Map<number, { department: Department; people: TreeNode[] }>();
    for (const dept of departments) {
      map.set(dept.id, { department: dept, people: [] });
    }
    for (const person of allPeople) {
      const group = map.get(person.departmentId);
      if (group) group.people.push(person);
    }
    return Array.from(map.values()).filter((g) => g.people.length > 0);
  }, [allPeople, departments]);

  const handleSelect = useCallback(
    (person: TreeNode) => {
      onSelect(person);
      setOpen(false);
    },
    [onSelect]
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title="Search (Ctrl+K)"
        aria-label="Search people"
        className="cursor-pointer transition-all duration-200"
      >
        <Search className="w-4 h-4" />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search People"
        description="Search by name, title, or department"
      >
        <Command>
          <CommandInput placeholder="Search by name or title..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {grouped.map(({ department, people }) => {
              const DeptIcon = getDeptIcon(department.name);
              return (
              <CommandGroup key={department.id} heading={department.name}>
                {people.map((person) => {
                  const initials = person.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <CommandItem
                      key={person.id}
                      value={`${person.name} ${person.title} ${department.name}`}
                      onSelect={() => handleSelect(person)}
                      className="cursor-pointer"
                    >
                      <Avatar className="w-6 h-6 shrink-0">
                        {person.photoUrl && (
                          <AvatarImage src={assetPath(person.photoUrl)} />
                        )}
                        <AvatarFallback className="bg-rs-primary-500/10 text-rs-primary-400 text-[9px]">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {person.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {person.title}
                        </p>
                      </div>
                      <span
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: `${department.color || "#666"}20`,
                          color: department.color || undefined,
                        }}
                      >
                        <DeptIcon className="w-2.5 h-2.5" />
                        {department.name}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
