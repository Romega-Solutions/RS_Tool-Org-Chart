import type { TreeNode, Person, Department } from "@/types";

export function buildTree(people: Person[], departments: Department[]): TreeNode[] {
  const deptMap = new Map<number, Department>();
  for (const d of departments) deptMap.set(d.id, d);

  const nodeMap = new Map<number, TreeNode>();
  for (const p of people) nodeMap.set(p.id, { ...p, children: [], department: deptMap.get(p.departmentId) });

  const roots: TreeNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.reportsTo === null) { roots.push(node); }
    else {
      const parent = nodeMap.get(node.reportsTo);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }

  function sortChildren(node: TreeNode) {
    node.children.sort((a, b) => a.displayOrder - b.displayOrder);
    for (const child of node.children) sortChildren(child);
  }
  for (const root of roots) sortChildren(root);
  return roots;
}
