import type { AuthUser, UserRole } from "@/types";

interface Credentials {
  password: string;
  name: string;
  role: UserRole;
}

const USERS: Record<string, Credentials> = {
  admin: { password: "admin123", name: "Admin", role: "editor" },
  editor: { password: "editor123", name: "Editor", role: "editor" },
  viewer: { password: "viewer123", name: "Viewer", role: "viewer" },
};

export function login(username: string, password: string): AuthUser | null {
  const user = USERS[username];
  if (user && user.password === password) {
    const userData: AuthUser = { username, name: user.name, role: user.role };
    if (typeof window !== "undefined") {
      localStorage.setItem("orgchart_user", JSON.stringify(userData));
    }
    return userData;
  }
  return null;
}

export function logout(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("orgchart_user");
  }
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window !== "undefined") {
    const str = localStorage.getItem("orgchart_user");
    if (str) {
      try { return JSON.parse(str); } catch { return null; }
    }
  }
  return null;
}

export function isEditor(): boolean {
  const user = getCurrentUser();
  return user?.role === "editor";
}
