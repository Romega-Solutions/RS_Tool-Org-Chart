# Quick-Add Person & Drag-to-Reorder Siblings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add (1) double-click canvas to open a quick-add person dialog, and (2) drag-to-reorder siblings with visual preview and undo.

**Architecture:** `QuickAddDialog` is a new controlled dialog component wired into `ChartCanvas`. The sibling reorder detection is an extension of the existing `findDropTarget` function in `TopDownTree` — sibling nodes get a teal preview instead of amber, and `ChartCanvas.handleReorder` updates `displayOrder` for all affected siblings via existing PATCH API.

**Tech Stack:** Next.js 16 App Router, `@xyflow/react`, Drizzle ORM + SQLite, Tailwind v4, TypeScript strict.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/chart/quick-add-dialog.tsx` | **Create** | Controlled dialog: Name, Title, Dept, Reports To → POST /api/people |
| `src/components/chart/top-down-tree.tsx` | **Modify** | Add `onCanvasDoubleClick`, `onReorder` props; pane double-click detection; extend `findDropTarget` return type; update drag handlers |
| `src/components/chart/person-node.tsx` | **Modify** | `dropTarget` field: extend from `boolean` to `boolean \| "reorder-before" \| "reorder-after"`; add teal ring + label for reorder states |
| `src/components/chart/chart-canvas.tsx` | **Modify** | Add `quickAddOpen` state, `handleCanvasDoubleClick`, `handleReorder`, `findParent` helper; render `QuickAddDialog` |

---

## Task 1: Create `QuickAddDialog`

**Files:**
- Create: `src/components/chart/quick-add-dialog.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { Department, Person } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (newPersonId: number) => void;
}

export function QuickAddDialog({ open, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [reportsTo, setReportsTo] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/departments").then((r) => r.json()).then(setDepartments);
    fetch("/api/people").then((r) => r.json()).then(setPeople);
  }, [open]);

  function reset() {
    setName("");
    setTitle("");
    setDepartmentId(null);
    setReportsTo(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !title.trim() || departmentId === null) return;
    setSaving(true);
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          title: title.trim(),
          departmentId,
          reportsTo,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const result = await res.json();
      reset();
      onOpenChange(false);
      onSaved(result.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!saving) {
          if (!o) reset();
          onOpenChange(o);
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Person</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qa-name">Name *</Label>
            <Input
              id="qa-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qa-title">Title *</Label>
            <Input
              id="qa-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Software Engineer"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Department *</Label>
            <Select
              value={departmentId !== null ? String(departmentId) : ""}
              onValueChange={(v) => setDepartmentId(Number(v))}
            >
              <SelectTrigger className="w-full">
                {departmentId !== null
                  ? (departments.find((d) => d.id === departmentId)?.name ?? "Select")
                  : <span className="text-muted-foreground">Select department</span>}
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reports To</Label>
            <Select
              value={reportsTo !== null ? String(reportsTo) : "none"}
              onValueChange={(v) => setReportsTo(v === "none" ? null : Number(v))}
            >
              <SelectTrigger className="w-full">
                {reportsTo !== null
                  ? (people.find((p) => p.id === reportsTo)?.name ?? "Select")
                  : <span className="text-muted-foreground">None (top-level)</span>}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (top-level)</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={saving || departmentId === null}
            className="w-full"
          >
            {saving ? "Saving..." : "Add Person"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd "RS_Tools/RS-Auto-Org_Chart-Generator"
pnpm tsc --noEmit
```

Expected: 0 errors.

---

## Task 2: Wire double-click in `TopDownTree` and `ChartCanvas`

**Files:**
- Modify: `src/components/chart/top-down-tree.tsx`
- Modify: `src/components/chart/chart-canvas.tsx`

- [ ] **Step 1: Add props to `TopDownTree` Props interface**

In `top-down-tree.tsx`, add two new optional props to the `Props` interface:

```tsx
// Add after the existing `highlightedNodeId` prop line:
  onCanvasDoubleClick?: () => void;
  onReorder?: (personId: number, siblingId: number, position: "before" | "after") => void;
```

Also destructure them in the function signature:

```tsx
export function TopDownTree({
  tree,
  isEditor,
  onNodeClick,
  onInit,
  onBackgroundContextMenu,
  onDrop,
  onDragMiss,
  onToggle,
  onDelete,
  onSelectionChange,
  selectedNodeIds,
  highlightedNodeId,
  onCanvasDoubleClick,   // add this
  onReorder,             // add this
}: Props) {
```

- [ ] **Step 2: Add pane double-click handler to `TopDownTree`**

After the `clearDropTargets` callback, add:

```tsx
const handlePaneDoubleClick = useCallback(
  (e: React.MouseEvent) => {
    if (!isEditor || !onCanvasDoubleClick) return;
    const target = e.target as HTMLElement;
    // Only fire if user clicked the pane, not a node
    if (target.closest(".react-flow__node")) return;
    onCanvasDoubleClick();
  },
  [isEditor, onCanvasDoubleClick]
);
```

- [ ] **Step 3: Apply `zoomOnDoubleClick={false}` and wire handler in the JSX**

In the JSX, wrap the existing `<div className="relative h-full w-full">` with an outer div that captures double-click:

Replace:
```tsx
  return (
    <ReactFlowProvider>
      <div className="relative h-full w-full">
```

With:
```tsx
  return (
    <ReactFlowProvider>
      <div className="relative h-full w-full" onDoubleClick={handlePaneDoubleClick}>
```

Also add `zoomOnDoubleClick={false}` to the `<ReactFlow>` element (put it next to `fitView`):

```tsx
          zoomOnDoubleClick={false}
          fitView
```

- [ ] **Step 4: Add quick-add state and handler to `ChartCanvas`**

In `chart-canvas.tsx`, add the import at the top:

```tsx
import { QuickAddDialog } from "./quick-add-dialog";
```

Inside `ChartCanvas`, after the existing `useState` declarations, add:

```tsx
  const [quickAddOpen, setQuickAddOpen] = useState(false);
```

Add the handler after `handleClearSelection`:

```tsx
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
```

- [ ] **Step 5: Pass `onCanvasDoubleClick` to `TopDownTree` and render `QuickAddDialog`**

In the JSX, add `onCanvasDoubleClick` to the `<TopDownTree>` element:

```tsx
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
```

Add the `QuickAddDialog` just before the closing `</div>` of the chart container (after `ConfirmDialog`):

```tsx
      {isEditor && (
        <QuickAddDialog
          open={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          onSaved={handleQuickAddSaved}
        />
      )}
```

- [ ] **Step 6: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: errors about `handleReorder` not defined — that's expected and will be fixed in Task 5. If other errors appear, fix them now.

---

## Task 3: Extend `findDropTarget` for sibling reorder detection

**Files:**
- Modify: `src/components/chart/top-down-tree.tsx`

- [ ] **Step 1: Add `DropResult` type above the component**

Add this type definition after the existing constants block (after `const NODE_HEIGHT = 90;`):

```tsx
type DropResult = {
  id: string;
  intent: "reassign" | "reorder-before" | "reorder-after";
} | null;
```

- [ ] **Step 2: Replace `findDropTarget` with the new version**

Replace the entire `findDropTarget` callback:

```tsx
  const findDropTarget = useCallback(
    (draggedNode: Node): DropResult => {
      if (!isEditor) return null;
      const draggedId = draggedNode.id;
      const descendants = descendantsMap.get(draggedId) || [];
      const excludeSet = new Set([draggedId, ...descendants]);

      const cx = draggedNode.position.x + NODE_WIDTH / 2;
      const cy = draggedNode.position.y + NODE_HEIGHT / 2;

      let closestNode: Node | null = null;
      let closestDist = Infinity;

      for (const node of nodes) {
        if (excludeSet.has(node.id)) continue;
        const dx = cx - (node.position.x + NODE_WIDTH / 2);
        const dy = cy - (node.position.y + NODE_HEIGHT / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestNode = node;
        }
      }

      if (!closestNode || closestDist > DROP_RADIUS) return null;

      // Check sibling relationship (same reportsTo = same parent)
      const draggedPerson = personMap.get(draggedId);
      const targetPerson = personMap.get(closestNode.id);

      if (
        draggedPerson &&
        targetPerson &&
        draggedPerson.reportsTo === targetPerson.reportsTo
      ) {
        const draggedCX = draggedNode.position.x + NODE_WIDTH / 2;
        const targetCX = closestNode.position.x + NODE_WIDTH / 2;
        const intent =
          draggedCX < targetCX ? "reorder-before" : "reorder-after";
        return { id: closestNode.id, intent };
      }

      return { id: closestNode.id, intent: "reassign" };
    },
    [isEditor, descendantsMap, nodes, personMap]
  );
```

- [ ] **Step 3: Update `handleNodeDrag` to use the new return type**

Replace the `handleNodeDrag` callback:

```tsx
  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      const startPos = dragStartRef.current;
      if (!startPos) return;

      const descendants = descendantsMap.get(draggedNode.id);

      const dx = draggedNode.position.x - startPos.x;
      const dy = draggedNode.position.y - startPos.y;
      const ddx = dx - lastDeltaRef.current.x;
      const ddy = dy - lastDeltaRef.current.y;
      lastDeltaRef.current = { x: dx, y: dy };

      const result = findDropTarget(draggedNode);
      const targetId = result?.id ?? null;
      const targetDropValue: string | boolean = result
        ? result.intent === "reassign"
          ? true
          : result.intent
        : false;

      setNodes((prev) => {
        const descSet = new Set(descendants || []);
        return prev.map((n) => {
          if (descSet.has(n.id) && (ddx !== 0 || ddy !== 0)) {
            return {
              ...n,
              position: { x: n.position.x + ddx, y: n.position.y + ddy },
              data: { ...n.data, dropTarget: false },
            };
          }
          const isTarget = n.id === targetId;
          const newDropValue = isTarget ? targetDropValue : false;
          if (n.data.dropTarget !== newDropValue) {
            return { ...n, data: { ...n.data, dropTarget: newDropValue } };
          }
          return n;
        });
      });
    },
    [descendantsMap, setNodes, findDropTarget]
  );
```

- [ ] **Step 4: Update `handleNodeDragStop` to route reorder vs reassign**

Replace the `handleNodeDragStop` callback:

```tsx
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      dragStartRef.current = null;
      lastDeltaRef.current = { x: 0, y: 0 };
      clearDropTargets();

      if (!isEditor) return;

      const result = findDropTarget(draggedNode);

      if (!result) {
        onDragMiss?.();
        return;
      }

      if (result.intent === "reassign") {
        onDrop?.(Number(draggedNode.id), Number(result.id));
      } else {
        const position =
          result.intent === "reorder-before" ? "before" : "after";
        onReorder?.(Number(draggedNode.id), Number(result.id), position);
      }
    },
    [isEditor, onDrop, onDragMiss, onReorder, findDropTarget, clearDropTargets]
  );
```

- [ ] **Step 5: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: errors about `handleReorder` in `chart-canvas.tsx` (not defined yet). No errors should exist in `top-down-tree.tsx` itself. If any appear there, fix them.

---

## Task 4: Update `PersonNode` for reorder visual states

**Files:**
- Modify: `src/components/chart/person-node.tsx`

- [ ] **Step 1: Replace the `dropTarget` section with extended type handling**

Replace the entire `PersonNodeComponent` function body with:

```tsx
function PersonNodeComponent({ data }: { data: Record<string, unknown> }) {
  const name = data.name as string;
  const title = data.title as string;
  const photoUrl = data.photoUrl as string | null;
  const departmentColor = data.departmentColor as string | null;
  const isRoot = data.isRoot as boolean;
  const highlighted = data.highlighted as boolean | undefined;
  const pathHighlighted = data.pathHighlighted as boolean | undefined;
  const dimmed = data.dimmed as boolean | undefined;
  const dropTarget = data.dropTarget as boolean | string | undefined;

  const isReassign = dropTarget === true;
  const isReorder =
    dropTarget === "reorder-before" || dropTarget === "reorder-after";
  const isDropActive = isReassign || isReorder;

  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        "group relative transition-all duration-200",
        dimmed && "opacity-30 scale-[0.97]",
        isDropActive && "scale-[1.06] z-50"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-4 -bottom-3 h-6 rounded-full bg-rs-neutral-900/12 blur-md transition-all duration-200 dark:bg-black/35",
          (highlighted || pathHighlighted) &&
            "bg-rs-primary-500/18 dark:bg-rs-primary-400/20"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-[-7px] rounded-[1.05rem] bg-white/72 opacity-85 blur-lg transition-all duration-200 dark:bg-white/[0.03] dark:opacity-100",
          (highlighted || pathHighlighted) &&
            "bg-rs-primary-500/8 dark:bg-rs-primary-400/10"
        )}
      />
      <div
        className={cn(
          "relative w-[128px] bg-card/98 backdrop-blur-[2px] border border-white/70 rounded-lg px-3 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.10),0_2px_0_rgba(255,255,255,0.65)_inset] hover:shadow-[0_24px_55px_rgba(15,23,42,0.14),0_2px_0_rgba(255,255,255,0.75)_inset] hover:border-rs-primary-300 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer dark:border-border dark:shadow-[0_20px_45px_rgba(0,0,0,0.34)] dark:hover:shadow-[0_24px_55px_rgba(0,0,0,0.42)]",
          highlighted &&
            "ring-2 ring-rs-primary-500 shadow-[0_26px_60px_rgba(0,112,224,0.18),0_2px_0_rgba(255,255,255,0.8)_inset] border-rs-primary-300 -translate-y-0.5 dark:shadow-[0_28px_60px_rgba(14,165,233,0.18)]",
          pathHighlighted &&
            "border-rs-primary-400 shadow-[0_24px_55px_rgba(0,112,224,0.12),0_2px_0_rgba(255,255,255,0.75)_inset] -translate-y-0.5 dark:border-rs-primary-500 dark:shadow-[0_24px_55px_rgba(14,165,233,0.14)]",
          isReassign &&
            "ring-[3px] ring-rs-accent-500 border-rs-accent-400 shadow-[0_0_24px_rgba(200,133,10,0.35),0_0_48px_rgba(200,133,10,0.15)] animate-pulse",
          isReorder &&
            "ring-[3px] ring-teal-500 border-teal-400 shadow-[0_0_24px_rgba(20,184,166,0.35),0_0_48px_rgba(20,184,166,0.15)] animate-pulse"
        )}
        style={{
          borderLeftColor: departmentColor || undefined,
          borderLeftWidth: 3,
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/75 via-white/28 to-transparent dark:from-white/[0.06] dark:via-transparent dark:to-transparent" />
        {!isRoot && (
          <Handle
            type="target"
            position={Position.Top}
            className="!bg-rs-primary-500 !w-2 !h-2"
          />
        )}
        <div className="relative flex flex-col items-center gap-2 text-center">
          <Avatar className="h-11 w-11 shadow-sm ring-1 ring-border/60">
            {photoUrl && <AvatarImage src={photoUrl} />}
            <AvatarFallback className="bg-rs-primary-500/20 text-rs-primary-400 text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 w-full">
            <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
              {name}
            </p>
            <p className="mt-1 line-clamp-2 text-[0.7rem] leading-snug text-muted-foreground">
              {title}
            </p>
          </div>
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-rs-primary-500 !w-2 !h-2"
        />
        {isReassign && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-rs-accent-500 px-2 py-0.5 text-[0.6rem] font-semibold text-white shadow-lg">
            Drop to reassign
          </div>
        )}
        {isReorder && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-teal-500 px-2 py-0.5 text-[0.6rem] font-semibold text-white shadow-lg">
            {dropTarget === "reorder-before" ? "Move before" : "Move after"}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

Expected: same pre-existing `handleReorder` errors from `chart-canvas.tsx`. No new errors.

---

## Task 5: Wire `handleReorder` in `ChartCanvas`

**Files:**
- Modify: `src/components/chart/chart-canvas.tsx`

- [ ] **Step 1: Add `findParent` helper (module-level, after `findPersonById`)**

In `chart-canvas.tsx`, add after the existing `findPersonById` function:

```tsx
function findParent(tree: TreeNode[], childId: number): TreeNode | null {
  for (const node of tree) {
    if (node.children.some((c) => c.id === childId)) return node;
    const found = findParent(node.children, childId);
    if (found) return found;
  }
  return null;
}
```

- [ ] **Step 2: Add `handleReorder` callback inside `ChartCanvas`**

Add after `handleDrop`:

```tsx
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
```

- [ ] **Step 3: Type-check — expect 0 errors now**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors. Fix any that appear before moving on.

- [ ] **Step 4: Commit**

```bash
git add \
  src/components/chart/quick-add-dialog.tsx \
  src/components/chart/top-down-tree.tsx \
  src/components/chart/person-node.tsx \
  src/components/chart/chart-canvas.tsx
git commit -m "feat(org-chart): quick-add on canvas double-click and drag-to-reorder siblings"
```

---

## Task 6: Manual Smoke Tests

No automated test framework is configured. Verify the following manually at `http://localhost:3000/chart` (logged in as editor).

- [ ] **Quick-add:**
  1. Double-click empty canvas area → `QuickAddDialog` opens
  2. Fill Name + Title + Department → click **Add Person** → dialog closes, new node appears on chart, chart zooms to it
  3. Escape key or click outside → dialog closes without creating a person
  4. Verify in `/admin/people` that the new person exists

- [ ] **Quick-add blocked for viewers:**
  1. Log in as a viewer-role account → double-click canvas → nothing happens

- [ ] **Sibling reorder — preview:**
  1. Drag a node toward a sibling → teal ring + "Move before" or "Move after" label appears
  2. Drag same node toward a non-sibling (different parent) → amber ring + "Drop to reassign" appears

- [ ] **Sibling reorder — commit:**
  1. Drag a node onto a sibling → node order updates in the chart
  2. Press Ctrl+Z → order reverts
  3. Press Ctrl+Y → order re-applies

- [ ] **No regression:**
  1. Drag-to-reassign still works (drag a node toward a node with a different parent)
  2. Path highlight on click still works
  3. PNG export still works (double-click hint label not in export)
