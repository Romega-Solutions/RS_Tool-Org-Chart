"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { ChartData } from "@/types";

export function useChartData() {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    // Only show loading spinner on initial load — refetches update in place
    if (!initialLoadDone.current) setLoading(true);
    try {
      const res = await fetch("/api/chart-data", { signal });
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

  return { data, loading, refetch: fetchData };
}
