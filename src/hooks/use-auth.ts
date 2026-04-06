"use client";
import { useState, useEffect, useCallback } from "react";
import { login as doLogin, logout as doLogout, getCurrentUser } from "@/lib/auth";
import type { AuthUser } from "@/types";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getCurrentUser());
    setLoading(false);
  }, []);

  const login = useCallback((username: string, password: string) => {
    const result = doLogin(username, password);
    if (result) setUser(result);
    return result;
  }, []);

  const logout = useCallback(() => {
    doLogout();
    setUser(null);
  }, []);

  return { user, loading, login, logout, isEditor: user?.role === "editor" };
}
