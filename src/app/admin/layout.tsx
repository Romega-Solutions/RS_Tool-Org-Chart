import { ProtectedRoute } from "@/components/auth/protected-route";
import { AdminSidebar } from "@/components/layout/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireEditor>
      <div className="flex min-h-screen"><AdminSidebar /><main className="flex-1 p-6">{children}</main></div>
    </ProtectedRoute>
  );
}
