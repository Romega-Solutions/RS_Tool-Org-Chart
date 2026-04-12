"use client";

import { ChartCanvas } from "@/components/chart/chart-canvas";

export default function ViewPage() {
  return (
    <div className="h-screen w-full">
      <ChartCanvas isEditor={false} />
    </div>
  );
}
