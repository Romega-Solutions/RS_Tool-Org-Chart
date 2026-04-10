"use client";
import { useState, useEffect, useCallback } from "react";
import type { ChartData } from "@/types";

export function useChartData() {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chart-data");
      const json = await res.json();
      setData(json);
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
