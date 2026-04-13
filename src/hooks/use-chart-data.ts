"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { ChartData } from "@/types";

export function useChartData() {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  const fetchData = useCallback(async () => {
    // Only show loading spinner on initial load — refetches update in place
    if (!initialLoadDone.current) setLoading(true);
    try {
      const res = await fetch("/api/chart-data");
      const json = await res.json();
      setData(json);
      initialLoadDone.current = true;
    } catch (err) {
      console.error("Failed to fetch chart data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, refetch: fetchData };
}
