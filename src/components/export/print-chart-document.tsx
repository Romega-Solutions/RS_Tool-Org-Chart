/* eslint-disable @next/next/no-img-element */
import { createElement } from "react";
import { getDeptIcon } from "@/lib/dept-icons";
import type { TreeNode } from "@/types";

interface Props {
  tree: TreeNode[];
  generatedAt: string;
}

function getInitials(name: string) {
  return name.split(" ").map((p) => p[0] ?? "").join("").toUpperCase().slice(0, 2);
}

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  function walk(n: TreeNode) { result.push(n); n.children.forEach(walk); }
  nodes.forEach(walk);
  return result;
}

function countPeople(nodes: TreeNode[]): number {
  return nodes.reduce((t, n) => t + 1 + countPeople(n.children), 0);
}

function groupByDepartment(tree: TreeNode[]) {
  const all = flattenTree(tree);
  const nameMap = new Map<number, string>();
  for (const p of all) nameMap.set(p.id, p.name);

  const groups = new Map<string, { color: string; people: (TreeNode & { managerName: string | null; reportCount: number })[] }>();
  for (const person of all) {
    const dept = person.department?.name ?? "Other";
    const color = person.department?.color ?? "#0070E0";
    if (!groups.has(dept)) groups.set(dept, { color, people: [] });
    groups.get(dept)!.people.push({
      ...person,
      managerName: person.reportsTo ? nameMap.get(person.reportsTo) ?? null : null,
      reportCount: person.children.length,
    });
  }
  return Array.from(groups.entries()).map(([name, { color, people }]) => ({ name, color, people }));
}

export function PrintChartDocument({ tree, generatedAt }: Props) {
  const total = countPeople(tree);
  const departments = groupByDepartment(tree);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header — matches app card style */}
      <header className="bg-card border border-border rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <img src="/assets/romega-logo-full.svg" alt="Romega Solutions" className="h-7 w-auto dark:brightness-[1.8] dark:saturate-[0.8]" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[0.65rem] font-bold uppercase tracking-wider bg-rs-primary-500 text-white px-2.5 py-1 rounded-full">{total} people</span>
            <span className="text-[0.65rem] font-bold uppercase tracking-wider bg-rs-primary-500 text-white px-2.5 py-1 rounded-full">{departments.length} depts</span>
            <span className="text-xs text-muted-foreground">{generatedAt}</span>
          </div>
        </div>
        <h1 className="text-xl font-bold text-rs-primary-500 border-t-2 border-rs-primary-500 pt-3" style={{ fontFamily: "Merriweather, Georgia, serif" }}>
          Organizational Chart
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Department directory prepared for print and PDF export.</p>

        {/* Department summary chips */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
          {departments.map((dept) => (
            <span
              key={dept.name}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground bg-muted border border-border px-2.5 py-1 rounded-sm"
              style={{ borderLeftWidth: 3, borderLeftColor: dept.color }}
            >
              {createElement(getDeptIcon(dept.name), { className: "w-3 h-3 shrink-0", style: { color: dept.color } })}
              <span>{dept.name}</span>
              <span className="text-[0.6rem] font-bold text-muted-foreground bg-border/60 px-1.5 py-px rounded-sm ml-0.5">{dept.people.length}</span>
            </span>
          ))}
        </div>
      </header>

      {/* Departments — single column, each dept is a row */}
      <div className="space-y-3">
        {departments.map((dept) => {
          const DeptIcon = getDeptIcon(dept.name);
          return (
            <div
              key={dept.name}
              className="bg-card border border-border rounded-lg overflow-hidden"
              style={{ borderLeftWidth: 3, borderLeftColor: dept.color }}
            >
              {/* Department header */}
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${dept.color}20` }}
                >
                  <DeptIcon className="w-3 h-3" style={{ color: dept.color }} />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{dept.name}</h3>
                <span className="text-xs text-muted-foreground ml-auto">{dept.people.length} {dept.people.length === 1 ? "person" : "people"}</span>
              </div>

              {/* People — horizontal wrap of compact cards */}
              <div className="p-2 flex flex-wrap gap-1.5">
                {dept.people.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/50 border border-border/50 min-w-[10rem] max-w-[16rem]"
                  >
                    {person.photoUrl ? (
                      <img src={person.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-border" />
                    ) : (
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                        style={{ backgroundColor: `${dept.color}15`, color: dept.color }}
                      >
                        {getInitials(person.name)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{person.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{person.title}</p>
                      {person.managerName && (
                        <p className="text-[9px] text-muted-foreground/60 truncate">→ {person.managerName}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <footer className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground tracking-wide">
        <span className="font-bold">Romega Solutions</span>
        <span className="opacity-40">&middot;</span>
        <span>Organizational Chart</span>
        <span className="opacity-40">&middot;</span>
        <span>{generatedAt}</span>
      </footer>
    </div>
  );
}
