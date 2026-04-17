import type { TreeNode, Person, Department } from "@/types";

export function buildTree(people: Person[], departments: Department[]): TreeNode[] {
  const deptMap = new Map<number, Department>();
  for (const d of departments) deptMap.set(d.id, d);

  const nodeMap = new Map<number, TreeNode>();
  for (const p of people) {
    nodeMap.set(p.id, { ...p, children: [], department: deptMap.get(p.departmentId) });
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
