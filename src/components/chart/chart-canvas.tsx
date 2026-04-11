"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import { useChartData } from "@/hooks/use-chart-data";
import { useUndo } from "@/hooks/use-undo";
import { ChartToolbar } from "@/components/layout/chart-toolbar";
import { ExportButtons } from "@/components/export/export-buttons";
import { PersonDetailPanel } from "./person-detail-panel";
import { TopDownTree } from "./top-down-tree";
import { HorizontalTree } from "./horizontal-tree";
import { CollapsibleTree } from "./collapsible-tree";
import { DepartmentGrid } from "./department-grid";
import type { TreeNode } from "@/types";

interface Props {
  isEditor: boolean;
}

export function ChartCanvas({ isEditor }: Props) {
  const { data, loading } = useChartData();
  const { push, undo, redo, canUndo, canRedo } = useUndo();
  const [view, setView] = useState("top-down");
  const [selectedPerson, setSelectedPerson] = useState<TreeNode | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  const handleNodeClick = useCallback((person: TreeNode) => {
    setSelectedPerson(person);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedPerson(null);
  }, []);

  const handleZoomIn = useCallback(() => {
    rfInstanceRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    rfInstanceRef.current?.zoomOut();
  }, []);

  const handleFitView = useCallback(() => {
    rfInstanceRef.current?.fitView({ padding: 0.2 });
  }, []);

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    rfInstanceRef.current = instance;
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-rs-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-rs-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-rs-neutral-400">Loading chart data...</p>
        </div>
      </div>
    );
  }

  if (!data || data.tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-rs-neutral-950">
        <div className="text-center space-y-2">
          <p className="text-rs-neutral-300">No chart data available.</p>
          <p className="text-sm text-rs-neutral-500">
            Import data or add people to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="chart-container" className="relative h-full w-full overflow-hidden bg-rs-neutral-950">
      {/* Toolbar */}
      <ChartToolbar
        view={view}
        onViewChange={setView}
        onUndo={undo}
        onRedo={redo}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        canUndo={canUndo}
        canRedo={canRedo}
        isEditor={isEditor}
      />

      {/* Export buttons */}
      <div className="absolute top-4 right-4 z-10 bg-rs-neutral-900/90 backdrop-blur-sm rounded-lg px-2 py-1 border border-rs-neutral-800">
        <ExportButtons />
      </div>

      {/* Active view */}
      {view === "grid" && (
        <DepartmentGrid
          tree={data.tree}
          departments={data.departments}
          onNodeClick={handleNodeClick}
        />
      )}
      {view === "top-down" && (
        <TopDownTree
          tree={data.tree}
          isEditor={isEditor}
          onNodeClick={handleNodeClick}
          onInit={handleInit}
        />
      )}
      {view === "horizontal" && (
        <HorizontalTree
          tree={data.tree}
          isEditor={isEditor}
          onNodeClick={handleNodeClick}
          onInit={handleInit}
        />
      )}
      {view === "collapsible" && (
        <CollapsibleTree
          tree={data.tree}
          isEditor={isEditor}
          onNodeClick={handleNodeClick}
          onInit={handleInit}
        />
      )}

      {/* Detail panel */}
      <PersonDetailPanel person={selectedPerson} onClose={handleClosePanel} />
    </div>
  );
}
