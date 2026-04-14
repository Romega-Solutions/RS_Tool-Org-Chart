"use client";

import { useMemo } from "react";
import { PrintChartDocument } from "@/components/export/print-chart-document";
import { PrintPageControls } from "@/components/export/print-page-controls";
import { useChartData } from "@/hooks/use-chart-data";

export default function ChartPrintPage() {
  const { data, loading } = useChartData();

  const generatedAt = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
    []
  );

  return (
    <div className="print-page">
      <PrintPageControls ready={!loading && Boolean(data?.tree.length)} />

      {loading && (
        <div className="print-page-message">
          <div className="print-page-spinner" />
          <p>Loading chart data...</p>
        </div>
      )}

      {!loading && (!data || data.tree.length === 0) && (
        <div className="print-page-message">
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>No chart data available</h1>
          <p>Import active people first, then open print again.</p>
        </div>
      )}

      {!loading && data && data.tree.length > 0 && (
        <PrintChartDocument tree={data.tree} generatedAt={generatedAt} />
      )}
    </div>
  );
}
