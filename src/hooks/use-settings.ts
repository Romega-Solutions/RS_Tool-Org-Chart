"use client";
import { apiPath } from "@/lib/paths";
import { useState, useEffect, useCallback } from "react";

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const res = await fetch(apiPath("/api/settings"));
    const data = await res.json();
    setSettings(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(apiPath("/api/settings"))
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setSettings(data);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const updateSettings = useCallback(async (updates: Record<string, string>) => {
    await fetch(apiPath("/api/settings"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  return { settings, loading, updateSettings, refetch: fetchSettings };
}
