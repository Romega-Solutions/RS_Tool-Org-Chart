"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  children: React.ReactNode;
  requireEditor?: boolean;
}

export function ProtectedRoute({ children, requireEditor = false }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && requireEditor && user?.role !== "editor") router.push("/chart");
  }, [user, loading, requireEditor, router]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-neutral-400">Loading...</p></div>;
  if (!user) return null;
  if (requireEditor && user.role !== "editor") return null;

  return <>{children}</>;
}
