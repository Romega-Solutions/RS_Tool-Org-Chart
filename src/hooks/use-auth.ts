"use client";
import { apiPath } from "@/lib/paths";
import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@/types";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiPath("/api/auth/me"))
      .then((r) => r.json())
      .then((data) => {
        setUser(data ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<AuthUser | null> => {
    const res = await fetch(apiPath("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return null;
    const userData: AuthUser = await res.json();
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    await fetch(apiPath("/api/auth/logout"), { method: "POST" });
    setUser(null);
  }, []);

  return { user, loading, login, logout, isEditor: user?.role === "editor" };
}
