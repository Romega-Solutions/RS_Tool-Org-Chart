"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useChartData } from "@/hooks/use-chart-data";
import { TopDownTree } from "@/components/chart/top-down-tree";
import { DepartmentGrid } from "@/components/chart/department-grid";

const noop = () => {};

function EmbedContent() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "top-down";
  const { data, loading } = useChartData();

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-rs-neutral-950">
        <p className="text-rs-neutral-400">Loading...</p>
      </div>
    );
  }

  switch (view) {
    case "grid":
      return (
        <div className="h-screen bg-rs-neutral-950">
          <DepartmentGrid
            tree={data.tree}
            departments={data.departments}
            onNodeClick={noop}
          />
        </div>
      );
    default:
      return (
        <div className="h-screen bg-rs-neutral-950">
          <TopDownTree tree={data.tree} isEditor={false} onNodeClick={noop} />
        </div>
      );
  }
}

export default function EmbedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-rs-neutral-950">
          <p className="text-rs-neutral-400">Loading...</p>
        </div>
      }
    >
      <EmbedContent />
    </Suspense>
  );
}
