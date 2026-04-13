"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import { useChartData } from "@/hooks/use-chart-data";
import { useUndo } from "@/hooks/use-undo";
import { ChartToolbar } from "@/components/layout/chart-toolbar";
import { ExportButtons } from "@/components/export/export-buttons";
import { ImportDialog } from "@/components/admin/import-dialog";
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
  const { data, loading, refetch } = useChartData();
  const { push, undo, redo, canUndo, canRedo } = useUndo();
  const [view, setView] = useState("top-down");
  const [selectedPerson, setSelectedPerson] = useState<TreeNode | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  const showFeedback = useCallback((msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  }, []);

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

  // Drag-to-edit: reassign a person's reportsTo when dropped near another node
  const handleDrop = useCallback(
    async (personId: number, targetId: number) => {
      // Prevent self-assignment
      if (personId === targetId) return;

      try {
        // Fetch current person to get old reportsTo for undo
        const personRes = await fetch(`/api/people/${personId}`);
        if (!personRes.ok) throw new Error("Failed to fetch person");
        const person = await personRes.json();
        const oldReportsTo = person.reportsTo;

        // Skip if already reporting to target
        if (oldReportsTo === targetId) return;

        // Patch reportsTo
        const patchRes = await fetch(`/api/people/${personId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportsTo: targetId }),
        });
        if (!patchRes.ok) throw new Error("Failed to update reporting line");

        // Push undo action
        push({
          description: `Move ${person.name} to report to #${targetId}`,
          undo: async () => {
            await fetch(`/api/people/${personId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reportsTo: oldReportsTo }),
            });
            await refetch();
          },
          redo: async () => {
            await fetch(`/api/people/${personId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reportsTo: targetId }),
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
    [push, refetch, showFeedback]
  );

  // Toggle active/inactive
  const handleToggle = useCallback(
    async (personId: number) => {
      try {
        const res = await fetch(`/api/people/${personId}/toggle`, {
          method: "PATCH",
        });
        if (!res.ok) throw new Error("Failed to toggle person");
        const updated = await res.json();

        push({
          description: `Toggle ${updated.name} active status`,
          undo: async () => {
            await fetch(`/api/people/${personId}/toggle`, { method: "PATCH" });
            await refetch();
          },
          redo: async () => {
            await fetch(`/api/people/${personId}/toggle`, { method: "PATCH" });
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
    [push, refetch, showFeedback]
  );

  // Delete person with confirmation
  const handleDelete = useCallback(
    async (personId: number, personName: string) => {
      const confirmed = window.confirm(
        `Are you sure you want to delete "${personName}"? This cannot be undone.`
      );
      if (!confirmed) return;

      try {
        const res = await fetch(`/api/people/${personId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete person");

        showFeedback(`Deleted ${personName}`);
        await refetch();
      } catch (err) {
        console.error("Delete failed:", err);
        showFeedback("Failed to delete person");
      }
    },
    [refetch, showFeedback]
  );

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
      />

      {/* Action buttons */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-border">
        {isEditor && <ImportDialog onImportComplete={refetch} />}
        <ExportButtons />
      </div>

      {/* Feedback toast */}
      {feedbackMsg && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-muted border border-border text-foreground text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2">
          {feedbackMsg}
        </div>
      )}

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
          onDrop={handleDrop}
          onToggle={handleToggle}
          onDelete={handleDelete}
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
