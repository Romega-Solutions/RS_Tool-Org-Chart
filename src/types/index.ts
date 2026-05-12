export interface Person {
  id: number;
  name: string;
  title: string;
  departmentId: number;
  reportsTo: number | null;
  photoUrl: string | null;
  email?: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  employmentType: string | null;
  projectIds: string | null;
}

export interface Department {
  id: number;
  name: string;
  color: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Setting {
  key: string;
  value: string;
}

export interface TreeNode extends Person {
  children: TreeNode[];
  department?: Department;
  secondaryReportsTo?: number[];
}

export interface ChartData {
  tree: TreeNode[];
  departments: Department[];
  settings: Record<string, string>;
}

export type UserRole = "editor" | "viewer";

export interface AuthUser {
  username: string;
  name: string;
  role: UserRole;
}
