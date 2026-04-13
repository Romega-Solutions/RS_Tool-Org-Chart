/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import type { TreeNode } from "@/types";

interface Props {
  tree: TreeNode[];
  generatedAt: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function countPeople(nodes: TreeNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countPeople(node.children), 0);
}

function getDepth(nodes: TreeNode[], level = 1): number {
  if (nodes.length === 0) return level;

  return Math.max(level, ...nodes.map((node) => getDepth(node.children, level + 1)));
}

function collectDepartments(nodes: TreeNode[], departments = new Set<string>()) {
  for (const node of nodes) {
    if (node.department?.name) {
      departments.add(node.department.name);
    }
    collectDepartments(node.children, departments);
  }

  return departments;
}

function PrintNode({ node, isRoot = false }: { node: TreeNode; isRoot?: boolean }) {
  return (
    <li className={`print-orgchart-node ${isRoot ? "print-orgchart-node--root" : ""}`}>
      <article
        className="print-person-card"
        style={
          {
            "--department-color": node.department?.color ?? "#0ea5e9",
          } as CSSProperties
        }
      >
        <div className="flex items-start gap-4">
          {node.photoUrl ? (
            <img
              src={node.photoUrl}
              alt={node.name}
              className="h-14 w-14 rounded-2xl border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sm font-bold text-sky-700">
              {getInitials(node.name)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-950">{node.name}</h3>
              {node.department?.name && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-600">
                  {node.department.name}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600">{node.title}</p>
            {node.employmentType && (
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                {node.employmentType}
              </p>
            )}
          </div>
        </div>
      </article>

      {node.children.length > 0 && (
        <ul className="print-orgchart-children">
          {node.children.map((child) => (
            <PrintNode key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function PrintChartDocument({ tree, generatedAt }: Props) {
  const totalPeople = countPeople(tree);
  const totalDepartments = collectDepartments(tree).size;
  const levels = getDepth(tree);

  return (
    <div className="print-chart-shell">
      <header className="print-chart-header">
        <div className="flex items-start gap-4">
          <img
            src="/assets/romega-logo-full.svg"
            alt="Romega Solutions"
            className="h-10 w-auto shrink-0"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
              Organizational Chart
            </p>
            <h1 className="mt-2 font-[family:var(--font-heading)] text-3xl font-bold text-slate-950">
              Print Layout
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Structured for consistent browser printing and PDF generation without
              relying on rasterized PNG snapshots.
            </p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Active People
            </dt>
            <dd className="mt-1 text-2xl font-semibold text-slate-950">{totalPeople}</dd>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Departments
            </dt>
            <dd className="mt-1 text-2xl font-semibold text-slate-950">{totalDepartments}</dd>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Generated
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-950">{generatedAt}</dd>
            <p className="mt-1 text-xs text-slate-500">{levels} reporting levels</p>
          </div>
        </dl>
      </header>

      <main className="mt-8 space-y-8">
        {tree.map((root) => (
          <section key={root.id} className="print-chart-section">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Reporting Structure
                </p>
                <h2 className="mt-1 font-[family:var(--font-heading)] text-2xl font-bold text-slate-950">
                  {root.department?.name ?? "Leadership Team"}
                </h2>
              </div>
              <p className="text-sm text-slate-500">{root.children.length} direct reports</p>
            </div>

            <div className="print-orgchart">
              <ul className="print-orgchart-tree">
                <PrintNode node={root} isRoot />
              </ul>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
