# Design: Quick-Add Person & Drag-to-Reorder Siblings

**Date:** 2026-04-17
**Scope:** Two chart interaction features for RS-Auto-Org_Chart-Generator
**Stack:** Next.js 16, React Flow (`@xyflow/react`), SQLite + Drizzle ORM, Tailwind v4

---

## Feature 1 — Double-click Canvas → Quick-Add Person

### Intent
Editor users can double-click any empty area of the org chart canvas to open a minimal add-person dialog, without navigating to the admin panel.

### Trigger Mechanism
ReactFlow does not expose `onPaneDoubleClick`. Solution:
- Wrap `<ReactFlow>` in a `<div onDoubleClick={handlePaneDoubleClick}>` inside `TopDownTree`
- In the handler, check `event.target.closest('.react-flow__node') === null` to confirm the click landed on the pane (not a node)
- Set `zoomOnDoubleClick={false}` on `<ReactFlow>` to prevent default zoom behavior

### New Component: `QuickAddDialog`
**File:** `src/components/chart/quick-add-dialog.tsx`

A lightweight controlled dialog (no `DialogTrigger`):
- Props: `open`, `onOpenChange`, `onSaved(newPersonId: number)`
- Fields: Name*, Title*, Department*, Reports To (optional)
- No photo upload — photo can be added later via the edit panel
- On mount (when `open` flips to true): fetches `/api/departments` and `/api/people`
- On submit: `POST /api/people` → calls `onSaved(result.id)` → parent refetches + zooms to new node
- Editor-only: only rendered/opened when `isEditor === true`

### Wiring
- `TopDownTree`: adds `onCanvasDoubleClick?: () => void` prop; fires it on confirmed pane double-click
- `ChartCanvas`: adds `quickAddOpen` state; `handleCanvasDoubleClick` sets it to `true`; after save → `refetch()` + `rfInstanceRef.current?.fitView({ nodes: [{ id: String(newId) }], ... })`

---

## Feature 2 — Drag-to-Reorder Siblings

### Intent
Editor users can drag a node horizontally among its siblings to change their left-to-right display order. This is distinct from drag-to-reassign (which changes `reportsTo`).

### Detection Logic (in `findDropTarget`)
Current signature: `findDropTarget(draggedNode) → string | null`
New signature: `findDropTarget(draggedNode) → { id: string; intent: "reassign" | "reorder-before" | "reorder-after" } | null`

Steps:
1. Find the closest non-descendant node within `DROP_RADIUS` (existing logic)
2. Look up the dragged person's `reportsTo` via `personMap`
3. Look up the target's `reportsTo` via `personMap`
4. If both share the same `reportsTo` value → **sibling reorder intent** (takes priority over reassign)
5. Determine position: if `draggedNode.position.x + NODE_WIDTH/2 < target.position.x + NODE_WIDTH/2` → `"reorder-before"`, else `"reorder-after"`
6. Otherwise → `"reassign"` (existing behavior)

### Visual Preview (PersonNode)
Change `dropTarget` field type from `boolean` to `boolean | "reorder-before" | "reorder-after"`.

| State | Visual |
|-------|--------|
| `"reassign"` (true) | Amber pulsing ring + "Drop to reassign" label (existing) |
| `"reorder-before"` | Teal ring + "Move before" label |
| `"reorder-after"` | Teal ring + "Move after" label |

### On Drop
- `handleNodeDragStop` reads the `findDropTarget` result intent
- If `"reassign"` → calls existing `onDrop(personId, targetId)` (unchanged)
- If `"reorder-before"` or `"reorder-after"` → calls new `onReorder(personId, targetId, "before" | "after")`

### `ChartCanvas.handleReorder`
1. Get dragged person from `personMap`; find all siblings (nodes with same `reportsTo` among `data.tree`)
2. Remove dragged person from sibling array, insert before or after `targetId`
3. Assign new `displayOrder` values: 0, 1, 2, ... sequentially
4. PATCH all siblings whose `displayOrder` changed via `PATCH /api/people/:id` with `{ displayOrder }`
5. Push undo action (re-PATCH with original displayOrders)
6. `showFeedback("Moved [name] in sibling order")` + `refetch()`

### API
No new endpoint needed. Uses existing `PATCH /api/people/:id` with `{ displayOrder }`. The DB schema already has `displayOrder` (`integer`, default 0). The `buildTree()` function already sorts siblings by `displayOrder`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/chart/quick-add-dialog.tsx` | **New** — lightweight controlled add-person dialog |
| `src/components/chart/top-down-tree.tsx` | Add `onCanvasDoubleClick`, `onReorder` props; update `findDropTarget`; wrap ReactFlow for double-click |
| `src/components/chart/person-node.tsx` | Extend `dropTarget` type; add teal reorder visual states |
| `src/components/chart/chart-canvas.tsx` | Wire `quickAddOpen`, `handleCanvasDoubleClick`, `handleReorder`; render `QuickAddDialog` |

**Not touched:** auth files, schema, API routes, other chart views (horizontal, collapsible, grid).

---

## Out of Scope
- Sibling reorder in horizontal/collapsible/grid views (top-down only for now)
- Pre-filling `reportsTo` on double-click based on proximity to a node
- Double-click on a node to open edit (already handled by single-click → detail panel)
