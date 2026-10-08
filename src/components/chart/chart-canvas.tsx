"use client";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import { useChartData } from "@/hooks/use-chart-data";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { ChartToolbar } from "@/components/layout/chart-toolbar";
import { ExportMenu } from "@/components/export/export-menu";
import { ChartSearch } from "./chart-search";
import { PersonDetailPanel } from "./person-detail-panel";
import { ChartContextMenu } from "./chart-context-menu";
import type { ViewMode } from "./view-switcher";
import { TopDownTree } from "./top-down-tree";
import { HorizontalTree } from "./horizontal-tree";
import { DepartmentGrid } from "./department-grid";
import type { TreeNode } from "@/types";
import { getTreeStats } from "@/lib/tree";

interface Props {
  dataEndpoint?: string;
  showExport?: boolean;
}

export function ChartCanvas({ dataEndpoint, showExport = true }: Props) {
  const { data, loading, error, refetch } = useChartData(dataEndpoint);
  const [view, setView] = useState<ViewMode>("top-down");
  const [selectedPerson, setSelectedPerson] = useState<TreeNode | null>(null);
  const [density, setDensity] = useState<"compact" | "comfortable">("comfortable");
  const [highlightedNodeId, setHighlightedNodeId] = useState<number | null>(null);
  const [chartMenu, setChartMenu] = useState<{ x: number; y: number } | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  // Auto-switch to grid view on mobile screens
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");

    function handleChange(e: MediaQueryListEvent | MediaQueryList) {
      if (e.matches) {
        setView("grid");
      }
    }

    // Check on mount
    handleChange(mql);

    // Listen for changes
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  const treeStats = useMemo(
    () => (data ? getTreeStats(data.tree) : null),
    [data]
  );

  const handleNodeClick = useCallback((person: TreeNode) => {
    setChartMenu(null);
    setSelectedPerson(person);
    setSelectedNodeIds([person.id]); // trigger path highlight
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedPerson(null);
    setSelectedNodeIds([]); // clear path highlight
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedPerson(null);
    setHighlightedNodeId(null);
  }, []);

  // Keyboard navigation: arrow keys traverse tree, Enter opens detail
  const handleZoomToNode = useCallback((nodeId: number) => {
    if (view !== "grid") {
      rfInstanceRef.current?.fitView({
        nodes: [{ id: String(nodeId) }],
        duration: 300,
        padding: 0.5,
      });
    } else {
      const el = document.getElementById(`person-card-${nodeId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setHighlightedNodeId(nodeId);
  }, [view]);

  useKeyboardNav(
    data?.tree ?? [],
    handleNodeClick,
    handleZoomToNode
  );

  const handleZoomIn = useCallback(() => {
    rfInstanceRef.current?.zoomIn({ duration: 220 });
  }, []);

  const handleZoomOut = useCallback(() => {
    rfInstanceRef.current?.zoomOut({ duration: 220 });
  }, []);

  const handleFitView = useCallback(() => {
    rfInstanceRef.current?.fitView({
      padding: 0.35,
      duration: 300,
      maxZoom: 1.5,
    });
  }, []);

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    rfInstanceRef.current = instance;
  }, []);

  const handleBackgroundContextMenu = useCallback((x: number, y: number) => {
    setChartMenu({ x, y });
  }, []);

  // Search select: highlight + zoom + open detail panel
  const handleSearchSelect = useCallback(
    (person: TreeNode) => {
      setSelectedPerson(person);
      setHighlightedNodeId(person.id);

      // Zoom to node for ReactFlow views
      if (view !== "grid") {
        setTimeout(() => {
          rfInstanceRef.current?.fitView({
            nodes: [{ id: String(person.id) }],
            duration: 500,
            padding: 0.5,
          });
        }, 100);
      } else {
        // Scroll to person card in grid view
        setTimeout(() => {
          const el = document.getElementById(`person-card-${person.id}`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    },
    [view]
  );

  // Auto-clear highlight after 3 seconds
  useEffect(() => {
    if (highlightedNodeId === null) return;
    const timer = setTimeout(() => setHighlightedNodeId(null), 3000);
    return () => clearTimeout(timer);
  }, [highlightedNodeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-rs-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading chart data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">No chart data available.</p>
          <p className="text-sm text-muted-foreground">
            People and reporting lines are managed in the Employee Portal&apos;s User Management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="chart-container" className="relative h-full w-full overflow-hidden bg-background">
      {/* Toolbar */}
      <ChartToolbar
        view={view}
        onViewChange={setView}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        searchSlot={
          <ChartSearch
            tree={data.tree}
            departments={data.departments}
            onSelect={handleSearchSelect}
          />
        }
        treeStats={treeStats ?? undefined}
        density={density}
        onDensityChange={setDensity}
      />

      {/* Action buttons */}
      {showExport && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-border">
          <ExportMenu />
        </div>
      )}

      {/* Active view */}
      <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="h-full w-full"
      >
      {view === "grid" && (
        <DepartmentGrid
          tree={data.tree}
          departments={data.departments}
          onNodeClick={handleNodeClick}
          onBackgroundContextMenu={handleBackgroundContextMenu}
          highlightedNodeId={highlightedNodeId}
          density={density}
        />
      )}
      {view === "top-down" && (
        <TopDownTree
          tree={data.tree}
          onNodeClick={handleNodeClick}
          onInit={handleInit}
          onBackgroundContextMenu={handleBackgroundContextMenu}
          selectedNodeIds={selectedNodeIds}
          highlightedNodeId={highlightedNodeId}
        />
      )}
      {view === "horizontal" && (
        <HorizontalTree
          tree={data.tree}
          onNodeClick={handleNodeClick}
          onInit={handleInit}
          onBackgroundContextMenu={handleBackgroundContextMenu}
          selectedNodeIds={selectedNodeIds}
          highlightedNodeId={highlightedNodeId}
        />
      )}
      </motion.div>
      </AnimatePresence>

      {chartMenu && (
        <ChartContextMenu
          x={chartMenu.x}
          y={chartMenu.y}
          onClose={() => setChartMenu(null)}
          onFitView={handleFitView}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onClearSelection={selectedPerson || highlightedNodeId !== null ? handleClearSelection : undefined}
        />
      )}

      {/* Detail panel */}
      <PersonDetailPanel person={selectedPerson} onClose={handleClosePanel} onSelectPerson={handleSearchSelect} tree={data.tree} />
    </div>
  );
}
