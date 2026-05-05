"use client";
import { apiPath } from "@/lib/paths";
import { useState, useEffect, useCallback, useRef } from "react";
import type { ChartData } from "@/types";

export function useChartData() {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (!initialLoadDone.current) setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiPath("/api/chart-data"), { signal });
      if (!res.ok) {
        throw new Error(`Failed to fetch chart data (${res.status})`);
      }
      const json = await res.json();
      if (signal?.aborted) return;
      setData(json);
      initialLoadDone.current = true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      console.error("Failed to fetch chart data:", err);
      if (!signal?.aborted) {
        setError("Failed to load chart data. Check your connection and try again.");
      }
    } finally {
      if (signal?.aborted) return;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
