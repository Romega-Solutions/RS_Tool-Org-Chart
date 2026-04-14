"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import { useChartData } from "@/hooks/use-chart-data";
import { useUndo } from "@/hooks/use-undo";
import { ChartToolbar } from "@/components/layout/chart-toolbar";
import { ExportMenu } from "@/components/export/export-menu";
import { ImportDialog } from "@/components/admin/import-dialog";
import { ChartSearch } from "./chart-search";
import { PersonDetailPanel } from "./person-detail-panel";
import { SelectionActionBar } from "./selection-action-bar";
import { ChartContextMenu } from "./chart-context-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ViewMode } from "./view-switcher";
import { TopDownTree } from "./top-down-tree";
import { HorizontalTree } from "./horizontal-tree";
import { CollapsibleTree } from "./collapsible-tree";
import { DepartmentGrid } from "./department-grid";
import type { TreeNode } from "@/types";

interface Props {
  isEditor: boolean;
}

function findPersonById(tree: TreeNode[], personId: number): TreeNode | null {
  for (const person of tree) {
    if (person.id === personId) {
      return person;
    }

    const childMatch = findPersonById(person.children, personId);
    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}

export function ChartCanvas({ isEditor }: Props) {
  const { data, loading, refetch } = useChartData();
  const { push, undo, redo, canUndo, canRedo } = useUndo();
  const [view, setView] = useState<ViewMode>("top-down");
  const [selectedPerson, setSelectedPerson] = useState<TreeNode | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<number | null>(null);
  const [chartMenu, setChartMenu] = useState<{ x: number; y: number } | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deleteIntent, setDeleteIntent] = useState<{
    ids: number[];
    title: string;
    description: string;
  } | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  const showFeedback = useCallback((msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  }, []);

  // Selection handlers
  const handleSelectionChange = useCallback((nodeIds: number[]) => {
    setSelectedNodeIds(nodeIds);
  }, []);

  const handleBulkActivate = useCallback(async () => {
    if (bulkBusy || selectedNodeIds.length === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(selectedNodeIds.map((id) =>
        fetch(`/api/people/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: true }) })
      ));
      showFeedback(`Activated ${selectedNodeIds.length} people`);
      setSelectedNodeIds([]);
      await refetch();
    } finally { setBulkBusy(false); }
  }, [bulkBusy, selectedNodeIds, refetch, showFeedback]);

  const handleBulkDeactivate = useCallback(async () => {
    if (bulkBusy || selectedNodeIds.length === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(selectedNodeIds.map((id) =>
        fetch(`/api/people/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: false }) })
      ));
      showFeedback(`Deactivated ${selectedNodeIds.length} people`);
      setSelectedNodeIds([]);
      await refetch();
    } finally { setBulkBusy(false); }
  }, [bulkBusy, selectedNodeIds, refetch, showFeedback]);

  const handleBulkDelete = useCallback(async () => {
    if (bulkBusy || selectedNodeIds.length === 0) return;
    const count = selectedNodeIds.length;
    setDeleteIntent({
      ids: selectedNodeIds,
      title: `Delete ${count} ${count === 1 ? "person" : "people"}?`,
      description: "This action permanently removes the selected people from the org chart.",
    });
  }, [bulkBusy, selectedNodeIds]);

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

  // Drag-to-edit: reassign a person's reportsTo when dropped near another node
  const handleDrop = useCallback(
    async (personId: number, targetId: number) => {
      // Prevent self-assignment
      if (personId === targetId) return;

      const person = data ? findPersonById(data.tree, personId) : null;
      if (!person) {
        showFeedback("Failed to find person");
        return;
      }

      const oldReportsTo = person.reportsTo;

      // Skip if already reporting to target
      if (oldReportsTo === targetId) return;

      try {
        const patchRes = await fetch("/api/people/reassign", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personId, reportsTo: targetId }),
        });
        if (!patchRes.ok) throw new Error("Failed to update reporting line");

        // Push undo action
        push({
          description: `Move ${person.name} to report to #${targetId}`,
          undo: async () => {
            await fetch("/api/people/reassign", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ personId, reportsTo: oldReportsTo }),
            });
            await refetch();
          },
          redo: async () => {
            await fetch("/api/people/reassign", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ personId, reportsTo: targetId }),
            });
            await refetch();
          },
        });

        showFeedback(`Moved ${person.name} under new manager`);
        await refetch();
      } catch (err) {
        console.error("Drag-to-edit failed:", err);
        showFeedback("Failed to reassign reporting line");
      }
    },
    [data, push, refetch, showFeedback]
  );

  // Toggle active/inactive
  const handleToggle = useCallback(
    async (personId: number) => {
      const current = data ? findPersonById(data.tree, personId) : null;
      if (!current) {
        showFeedback("Failed to find person");
        return;
      }

      const nextIsActive = !current.isActive;

      try {
        const res = await fetch(`/api/people/${personId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: nextIsActive }),
        });
        if (!res.ok) throw new Error("Failed to toggle person");
        const updated = await res.json();

        push({
          description: `Toggle ${updated.name} active status`,
          undo: async () => {
            await fetch(`/api/people/${personId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isActive: current.isActive }),
            });
            await refetch();
          },
          redo: async () => {
            await fetch(`/api/people/${personId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isActive: nextIsActive }),
            });
            await refetch();
          },
        });

        showFeedback(
          `${updated.name} ${updated.isActive ? "activated" : "deactivated"}`
        );
        await refetch();
      } catch (err) {
        console.error("Toggle failed:", err);
        showFeedback("Failed to toggle active status");
      }
    },
    [data, push, refetch, showFeedback]
  );

  // Delete person with confirmation
  const handleDelete = useCallback(
    async (personId: number, personName: string) => {
      setDeleteIntent({
        ids: [personId],
        title: `Delete ${personName}?`,
        description: "This action permanently removes the person from the org chart.",
      });
    },
    []
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteIntent || bulkBusy) return;
    const count = deleteIntent.ids.length;
    setBulkBusy(true);
    try {
      await Promise.all(deleteIntent.ids.map((id) => fetch(`/api/people/${id}`, { method: "DELETE" })));
      showFeedback(`Deleted ${count} ${count === 1 ? "person" : "people"}`);
      setSelectedNodeIds((current) => current.filter((id) => !deleteIntent.ids.includes(id)));
      setDeleteIntent(null);
      await refetch();
    } catch (err) {
      console.error("Delete failed:", err);
      showFeedback("Failed to delete person");
    } finally {
      setBulkBusy(false);
    }
  }, [deleteIntent, bulkBusy, refetch, showFeedback]);

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
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-rs-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading chart data...</p>
        </div>
      </div>
    );
  }

  if (!data || data.tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <p className="text-muted-foreground">No chart data available.</p>
            <p className="text-sm text-muted-foreground">
              Import data or add people to get started.
            </p>
          </div>
          {isEditor && (
            <div className="flex items-center justify-center gap-3">
              <ImportDialog onImportComplete={refetch} />
              <a href="/admin/team" className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200">
                Add People
              </a>
            </div>
          )}
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
        onUndo={undo}
        onRedo={redo}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        canUndo={canUndo}
        canRedo={canRedo}
        isEditor={isEditor}
        searchSlot={
          <ChartSearch
            tree={data.tree}
            departments={data.departments}
            onSelect={handleSearchSelect}
          />
        }
      />

      {/* Action buttons */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-border">
        <ImportDialog onImportComplete={refetch} />
        <ExportMenu />
      </div>

      {/* Feedback toast */}
      {feedbackMsg && (
        <div role="status" aria-live="polite" className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-muted border border-border text-foreground text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2">
          {feedbackMsg}
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
          isEditor={isEditor}
          onNodeClick={handleNodeClick}
          onBackgroundContextMenu={handleBackgroundContextMenu}
          onToggle={isEditor ? handleToggle : undefined}
          onDelete={isEditor ? handleDelete : undefined}
          highlightedNodeId={highlightedNodeId}
        />
      )}
      {view === "top-down" && (
        <TopDownTree
          tree={data.tree}
          isEditor={isEditor}
          onNodeClick={handleNodeClick}
          onInit={handleInit}
          onBackgroundContextMenu={handleBackgroundContextMenu}
          onDrop={handleDrop}
          onDragMiss={() => showFeedback("Drop onto another person to reassign reporting line")}
          onToggle={isEditor ? handleToggle : undefined}
          onDelete={isEditor ? handleDelete : undefined}
          onSelectionChange={isEditor ? handleSelectionChange : undefined}
          selectedNodeIds={selectedNodeIds}
          highlightedNodeId={highlightedNodeId}
        />
      )}
      {view === "horizontal" && (
        <HorizontalTree
          tree={data.tree}
          isEditor={isEditor}
          onNodeClick={handleNodeClick}
          onInit={handleInit}
          onBackgroundContextMenu={handleBackgroundContextMenu}
          onToggle={isEditor ? handleToggle : undefined}
          onDelete={isEditor ? handleDelete : undefined}
          onSelectionChange={isEditor ? handleSelectionChange : undefined}
          selectedNodeIds={selectedNodeIds}
          highlightedNodeId={highlightedNodeId}
        />
      )}
      {view === "collapsible" && (
        <CollapsibleTree
          tree={data.tree}
          isEditor={isEditor}
          onNodeClick={handleNodeClick}
          onInit={handleInit}
          onBackgroundContextMenu={handleBackgroundContextMenu}
          onToggle={isEditor ? handleToggle : undefined}
          onDelete={isEditor ? handleDelete : undefined}
          onSelectionChange={isEditor ? handleSelectionChange : undefined}
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

      {/* Selection action bar */}
      {isEditor && (
        <SelectionActionBar
          count={selectedNodeIds.length}
          onActivate={handleBulkActivate}
          onDeactivate={handleBulkDeactivate}
          onDelete={handleBulkDelete}
          onClear={() => setSelectedNodeIds([])}
          busy={bulkBusy}
        />
      )}

      {/* Detail panel */}
      <PersonDetailPanel person={selectedPerson} onClose={handleClosePanel} onSelectPerson={handleSearchSelect} tree={data.tree} />
      <ConfirmDialog
        open={Boolean(deleteIntent)}
        title={deleteIntent?.title || "Confirm delete"}
        description={deleteIntent?.description || ""}
        confirmLabel="Delete"
        destructive
        busy={bulkBusy}
        onConfirm={confirmDelete}
        onOpenChange={(open) => {
          if (!open && !bulkBusy) setDeleteIntent(null);
        }}
      />
    </div>
  );
}
