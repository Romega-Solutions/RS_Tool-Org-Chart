"use client";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { ChartCanvas } from "@/components/chart/chart-canvas";
import { useAuth } from "@/hooks/use-auth";

export default function ChartPage() {
  const { isEditor } = useAuth();

  return (
    <ProtectedRoute>
      <div className="flex h-screen">
        {isEditor && <AdminSidebar />}
        <div className="flex-1">
          <ChartCanvas isEditor={isEditor} />
        </div>
      </div>
    </ProtectedRoute>
  );
}
