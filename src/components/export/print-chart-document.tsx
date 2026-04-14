/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
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

  const groups = new Map<string, { color: string; people: (TreeNode & { managerName: string | null })[] }>();
  for (const person of all) {
    const dept = person.department?.name ?? "Other";
    const color = person.department?.color ?? "#0070E0";
    if (!groups.has(dept)) groups.set(dept, { color, people: [] });
    groups.get(dept)!.people.push({
      ...person,
      managerName: person.reportsTo ? nameMap.get(person.reportsTo) ?? null : null,
    });
  }
  return Array.from(groups.entries()).map(([name, { color, people }]) => ({ name, color, people }));
}

export function PrintChartDocument({ tree, generatedAt }: Props) {
  const total = countPeople(tree);
  const departments = groupByDepartment(tree);

  return (
    <div className="pd">
      {/* Header */}
      <header className="pd-hdr">
        <div className="pd-hdr-row">
          <img src="/assets/romega-logo-full.svg" alt="Romega Solutions" className="pd-logo" />
          <div className="pd-hdr-meta">
            <span className="pd-hdr-badge">{total} people</span>
            <span className="pd-hdr-badge">{departments.length} departments</span>
            <span className="pd-hdr-date">{generatedAt}</span>
          </div>
        </div>
        <h1 className="pd-title">Organizational Chart</h1>
        <p className="pd-subtitle">
          Department directory prepared for print and PDF export.
        </p>
      </header>

      {/* Departments */}
      {departments.map((dept) => (
        <section key={dept.name} className="pd-dept">
          <div className="pd-dept-hdr">
            <span className="pd-dept-dot" style={{ background: dept.color }} />
            <h2 className="pd-dept-name">{dept.name}</h2>
            <span className="pd-dept-count">{dept.people.length}</span>
          </div>
          <div className="pd-grid">
            {dept.people.map((person) => (
              <div
                key={person.id}
                className="pd-card"
                style={{ "--c": dept.color } as CSSProperties}
              >
                {person.photoUrl ? (
                  <img src={person.photoUrl} alt="" className="pd-avatar" />
                ) : (
                  <span className="pd-avatar-fb" style={{ background: `${dept.color}15`, color: dept.color }}>
                    {getInitials(person.name)}
                  </span>
                )}
                <div className="pd-card-body">
                  <p className="pd-name">{person.name}</p>
                  <p className="pd-role">{person.title}</p>
                  {person.managerName && <p className="pd-mgr">Reports to: {person.managerName}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <footer className="pd-footer">
        Romega Solutions &middot; Org Chart &middot; {generatedAt}
      </footer>
    </div>
  );
}
