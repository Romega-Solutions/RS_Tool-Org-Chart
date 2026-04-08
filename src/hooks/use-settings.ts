"use client";
import { useState, useEffect, useCallback } from "react";

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setSettings(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSettings = useCallback(async (updates: Record<string, string>) => {
    await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  return { settings, loading, updateSettings, refetch: fetchSettings };
}
