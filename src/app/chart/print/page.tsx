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
    <div className="print-chart-root min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_45%,#f8fafc_100%)] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <PrintPageControls ready={!loading && Boolean(data?.tree.length)} />

      {loading && (
        <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-slate-200 bg-white px-8 py-16 text-center shadow-sm">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
          <p className="mt-4 text-sm text-slate-500">Loading print layout...</p>
        </div>
      )}

      {!loading && (!data || data.tree.length === 0) && (
        <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-slate-200 bg-white px-8 py-16 text-center shadow-sm">
          <h1 className="font-[family:var(--font-heading)] text-2xl font-bold text-slate-950">
            No chart data available
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Import active people first, then open print again.
          </p>
        </div>
      )}

      {!loading && data && data.tree.length > 0 && (
        <PrintChartDocument tree={data.tree} generatedAt={generatedAt} />
      )}
    </div>
  );
}
