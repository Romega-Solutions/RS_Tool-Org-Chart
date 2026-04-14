/* eslint-disable @next/next/no-img-element */
import { createElement, type CSSProperties } from "react";
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

        {/* Department summary chips */}
        <div className="pd-dept-chips">
          {departments.map((dept) => (
            <span key={dept.name} className="pd-dept-chip" style={{ "--c": dept.color } as CSSProperties}>
              {createElement(getDeptIcon(dept.name), { className: "pd-dept-chip-icon", style: { color: dept.color } })}
              <span>{dept.name}</span>
              <span className="pd-dept-chip-count">{dept.people.length}</span>
            </span>
          ))}
        </div>
      </header>

      {/* Departments */}
      {departments.map((dept) => (
        <section key={dept.name} className="pd-dept">
          <div className="pd-dept-hdr">
            <span className="pd-dept-icon-wrap" style={{ background: `${dept.color}18`, color: dept.color }}>
              {createElement(getDeptIcon(dept.name), { className: "pd-dept-icon" })}
            </span>
            <h2 className="pd-dept-name">{dept.name}</h2>
            <span className="pd-dept-count">{dept.people.length} {dept.people.length === 1 ? "person" : "people"}</span>
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
                  {person.managerName && (
                    <p className="pd-mgr">
                      <span className="pd-mgr-label">Reports to</span> {person.managerName}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <footer className="pd-footer">
        <span className="pd-footer-brand">Romega Solutions</span>
        <span className="pd-footer-sep">&middot;</span>
        <span>Organizational Chart</span>
        <span className="pd-footer-sep">&middot;</span>
        <span>{generatedAt}</span>
      </footer>
    </div>
  );
}
