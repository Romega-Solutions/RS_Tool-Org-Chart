import type { TreeNode, Person, Department } from "@/types";
import { parseSecondaryReportsTo } from "@/lib/secondary-reporting";

export function buildTree(people: Person[], departments: Department[]): TreeNode[] {
  const deptMap = new Map<number, Department>();
  for (const d of departments) deptMap.set(d.id, d);

  const nodeMap = new Map<number, TreeNode>();
  for (const p of people) {
    nodeMap.set(p.id, {
      ...p,
      children: [],
      department: deptMap.get(p.departmentId),
      secondaryReportsTo: parseSecondaryReportsTo(p.projectIds),
    });
  }

  function hasCycle(startId: number): boolean {
    const visited = new Set<number>();
    let current: number | null | undefined = startId;
    while (current != null) {
      if (visited.has(current)) return true;
      visited.add(current);
      current = nodeMap.get(current)?.reportsTo;
    }
    return false;
  }

  const roots: TreeNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.reportsTo === null || node.reportsTo === undefined) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(node.reportsTo);
      if (!parent || hasCycle(node.id)) {
        roots.push(node);
      } else {
        parent.children.push(node);
      }
    }
  }

  function sortChildren(node: TreeNode) {
    node.children.sort((a, b) => a.displayOrder - b.displayOrder);
    for (const child of node.children) sortChildren(child);
  }
  for (const root of roots) sortChildren(root);

  return roots;
}

export function getTreeStats(tree: TreeNode[]): { people: number; depth: number } {
  function countPeople(nodes: TreeNode[]): number {
    return nodes.reduce((sum, n) => sum + 1 + countPeople(n.children), 0);
  }

  function maxDepth(nodes: TreeNode[], level: number): number {
    if (nodes.length === 0) return level;
    return Math.max(...nodes.map((n) => maxDepth(n.children, level + 1)));
  }

  return {
    people: countPeople(tree),
    depth: tree.length === 0 ? 0 : maxDepth(tree, 1),
  };
}
