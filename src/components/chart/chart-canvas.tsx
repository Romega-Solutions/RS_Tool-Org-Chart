"use client";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import { useChartData } from "@/hooks/use-chart-data";
import { useUndo } from "@/hooks/use-undo";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { ChartToolbar } from "@/components/layout/chart-toolbar";
import { ExportMenu } from "@/components/export/export-menu";
import { ImportDialog } from "@/components/admin/import-dialog";
import { ChartSearch } from "./chart-search";
import { PersonDetailPanel } from "./person-detail-panel";
import { SelectionActionBar } from "./selection-action-bar";
import { ChartContextMenu } from "./chart-context-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QuickAddDialog } from "./quick-add-dialog";
import type { ViewMode } from "./view-switcher";
import { TopDownTree } from "./top-down-tree";
import { HorizontalTree } from "./horizontal-tree";
import { CollapsibleTree } from "./collapsible-tree";
import { DepartmentGrid } from "./department-grid";
import type { TreeNode } from "@/types";
import { getTreeStats } from "@/lib/tree";

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

/** Returns true if `nodeId` is a descendant of `ancestorId` in the tree. */
function isDescendant(tree: TreeNode[], ancestorId: number, nodeId: number): boolean {
  function walk(node: TreeNode): boolean {
    if (node.id === ancestorId) {
      function hasNode(n: TreeNode): boolean {
        if (n.id === nodeId) return true;
        return n.children.some(hasNode);
      }
      return node.children.some(hasNode);
    }
    return node.children.some(walk);
  }
  return tree.some(walk);
}

export function ChartCanvas({ isEditor }: Props) {
  const { data, loading, error, refetch } = useChartData();
  const { push, undo, redo, canUndo, canRedo } = useUndo();
  const [view, setView] = useState<ViewMode>("top-down");
  const [selectedPerson, setSelectedPerson] = useState<TreeNode | null>(null);
  const [density, setDensity] = useState<"compact" | "comfortable">("comfortable");
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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
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

  const showFeedback = useCallback((msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  }, []);

  const treeStats = useMemo(
    () => (data ? getTreeStats(data.tree) : null),
    [data]
  );

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
    } catch {
      showFeedback("Failed to activate selected people");
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
    } catch {
      showFeedback("Failed to deactivate selected people");
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

  const handleCanvasDoubleClick = useCallback(() => {
    setQuickAddOpen(true);
  }, []);

  const handleQuickAddSaved = useCallback(
    async (newPersonId: number) => {
      await refetch();
      showFeedback("Person added");
      setTimeout(() => {
        rfInstanceRef.current?.fitView({
          nodes: [{ id: String(newPersonId) }],
          duration: 400,
          padding: 0.5,
        });
      }, 150);
    },
    [refetch, showFeedback]
  );

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

  const { focusedNodeId } = useKeyboardNav(
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

  // Drag-to-edit: reassign a person's reportsTo when dropped near another node
  const handleDrop = useCallback(
    async (personId: number, targetId: number) => {
      // Prevent self-assignment
      if (personId === targetId) return;

      // Prevent moving a person under their own descendant (would create a cycle)
      if (data && isDescendant(data.tree, personId, targetId)) {
        showFeedback("Can't move a person to report to one of their own reports");
        return;
      }

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

  const handleReorder = useCallback(
    async (personId: number, siblingId: number, position: "before" | "after") => {
      if (!data) return;

      const person = findPersonById(data.tree, personId);
      if (!person) { showFeedback("Failed to find person"); return; }

      // Get all siblings (nodes sharing the same parent)
      const parent =
        person.reportsTo !== null
          ? findPersonById(data.tree, person.reportsTo)
          : null;

      // Guard: if reportsTo is set but parent isn't in the active tree, bail out
      if (person.reportsTo !== null && parent === null) {
        showFeedback("Could not reorder: manager not found");
        return;
      }

      const siblings: TreeNode[] = parent ? [...parent.children] : [...data.tree];

      // Snapshot original displayOrders for undo
      const originalOrders = siblings.map((s) => ({
        id: s.id,
        displayOrder: s.displayOrder,
      }));

      // Build new order: remove dragged, insert before/after sibling
      const withoutDragged = siblings.filter((s) => s.id !== personId);
      const targetIdx = withoutDragged.findIndex((s) => s.id === siblingId);
      if (targetIdx === -1) { showFeedback("Could not reorder"); return; }

      const insertIdx = position === "before" ? targetIdx : targetIdx + 1;
      withoutDragged.splice(insertIdx, 0, person);
      const newOrder = withoutDragged;

      // Only PATCH nodes whose displayOrder actually changed
      const updates = newOrder
        .map((s, i) => ({ id: s.id, displayOrder: i }))
        .filter((u) => {
          const orig = originalOrders.find((o) => o.id === u.id);
          return orig !== undefined && orig.displayOrder !== u.displayOrder;
        });

      if (updates.length === 0) return;

      try {
        await Promise.all(
          updates.map((u) =>
            fetch(`/api/people/${u.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ displayOrder: u.displayOrder }),
            })
          )
        );

        push({
          description: `Reorder ${person.name} among siblings`,
          undo: async () => {
            await Promise.all(
              originalOrders.map((u) =>
                fetch(`/api/people/${u.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ displayOrder: u.displayOrder }),
                })
              )
            );
            await refetch();
          },
          redo: async () => {
            await Promise.all(
              updates.map((u) =>
                fetch(`/api/people/${u.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ displayOrder: u.displayOrder }),
                })
              )
            );
            await refetch();
          },
        });

        showFeedback(`Moved ${person.name} in sibling order`);
        await refetch();
      } catch (err) {
        console.error("Reorder failed:", err);
        showFeedback("Failed to reorder");
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
      const person = data ? findPersonById(data.tree, personId) : null;
      const directReports = person?.children.length ?? 0;
      const cascadeNote = directReports > 0
        ? ` This person has ${directReports} direct report${directReports === 1 ? "" : "s"} who will be moved to the top level.`
        : "";
      setDeleteIntent({
        ids: [personId],
        title: `Delete ${personName}?`,
        description: `This action permanently removes the person from the org chart.${cascadeNote}`,
      });
    },
    [data]
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
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <p className="text-muted-foreground">No chart data available.</p>
            <p className="text-sm text-muted-foreground">
              Import data or add people to get started.
            </p>
          </div>
          {isEditor && (
            <div className="flex items-center justify-center gap-3">
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
        treeStats={treeStats ?? undefined}
        density={density}
        onDensityChange={setDensity}
      />

      {/* Action buttons */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-xl px-3 py-2 border border-border">
        {isEditor && <ImportDialog onImportComplete={refetch} />}
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
          density={density}
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
          onCanvasDoubleClick={isEditor ? handleCanvasDoubleClick : undefined}
          onReorder={isEditor ? handleReorder : undefined}
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
      {isEditor && (
        <QuickAddDialog
          open={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          onSaved={handleQuickAddSaved}
        />
      )}
    </div>
  );
}
