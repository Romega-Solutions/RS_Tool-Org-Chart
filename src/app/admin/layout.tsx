import { ProtectedRoute } from "@/components/auth/protected-route";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireEditor>
      <TooltipProvider delay={300}>
        <div className="flex min-h-screen"><AdminSidebar /><main className="flex-1 p-6">{children}</main></div>
        <Toaster />
      </TooltipProvider>
    </ProtectedRoute>
  );
}
