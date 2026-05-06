"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { routerPath } from "@/lib/paths";

interface Props {
  children: React.ReactNode;
  requireEditor?: boolean;
}

export function ProtectedRoute({ children, requireEditor = false }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(routerPath(`/login?next=${encodeURIComponent(routerPath(next))}`));
    }
    if (!loading && requireEditor && user?.role !== "editor") {
      router.replace(routerPath("/chart"));
    }
  }, [user, loading, requireEditor, router]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">Loading...</p></div>;
  if (!user) return null;
  if (requireEditor && user.role !== "editor") return null;

  return <>{children}</>;
}
