"use client";
import { useState, useEffect, useCallback, useMemo, createElement, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PersonForm } from "@/components/admin/person-form";
import { Pencil, Trash2, Plus, Search, CheckCircle2, XCircle, X, Check, Minus, ArrowUpAZ, ArrowDownZA, ArrowUpDown, ArrowDownUp, Group, Filter, CircleDot, CircleOff, ListFilter, Bookmark, BookmarkCheck, Users, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDeptIcon } from "@/lib/dept-icons";
import type { Person } from "@/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

interface PersonRow extends Person {
  departmentName: string | null;
  departmentColor: string | null;
}

type SortColumn = "person" | "person-desc" | "title" | "title-desc" | "department" | "department-desc" | null;
type StatusFilter = "active" | "inactive" | "all";

interface SavedView {
  id: string;
  name: string;
  sort: SortColumn;
  status: StatusFilter;
}

const SAVED_VIEWS_KEY = "orgchart-people-saved-views";

function loadSavedViews(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSavedViews(views: SavedView[]) {
  localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
}

function DepartmentBadge({
  departmentName,
  departmentColor,
}: {
  departmentName: string | null;
  departmentColor: string | null;
}) {
  if (!departmentName) {
    return <span className="text-muted-foreground">--</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: departmentColor ? `${departmentColor}18` : "#88888818",
        color: departmentColor || "#888",
        border: `1px solid ${departmentColor ? `${departmentColor}30` : "#88888830"}`,
      }}
    >
      {createElement(getDeptIcon(departmentName), { className: "size-3" })}
      {departmentName}
    </span>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0]?.toLowerCase() || "";
}

function compareNames(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function getTitleRank(title: string): number {
  const value = title.toLowerCase();

  if (value.includes("founder") || value.includes("owner") || value.includes("president")) {
    return 120;
  }

  if (
    value.includes("chief") ||
    value.includes("ceo") ||
    value.includes("coo") ||
    value.includes("cto") ||
    value.includes("cfo") ||
    value.includes("cio") ||
    value.includes("cmo")
  ) {
    return 100;
  }

  if (
    value.includes("vice president") ||
    value.includes("vp") ||
    value.includes("director") ||
    value.includes("head")
  ) {
    return 80;
  }

  if (
    value.includes("manager") ||
    value.includes("lead") ||
    value.includes("principal") ||
    value.includes("supervisor")
  ) {
    return 60;
  }

  if (value.includes("senior")) {
    return 50;
  }

  if (
    value.includes("engineer") ||
    value.includes("developer") ||
    value.includes("designer") ||
    value.includes("analyst") ||
    value.includes("recruiter") ||
    value.includes("specialist") ||
    value.includes("consultant") ||
    value.includes("coordinator") ||
    value.includes("executive") ||
    value.includes("associate")
  ) {
    return 35;
  }

  if (value.includes("assistant") || value.includes("staff")) {
    return 20;
  }

  if (value.includes("intern") || value.includes("ojt") || value.includes("trainee")) {
    return 0;
  }

  return 25;
}

function SmoothCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (shiftKey: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <label
      className="group relative inline-flex cursor-pointer items-center justify-center"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onChange(e.shiftKey);
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        aria-label={ariaLabel}
        aria-checked={indeterminate ? "mixed" : checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={() => {/* handled by label onClick */}}
        className="peer sr-only"
      />
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-md border bg-background text-primary-foreground shadow-sm transition-all duration-200 ease-out",
          "border-border/80 group-hover:border-rs-primary-300 group-hover:bg-rs-primary-500/5",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-rs-primary-500/25 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
          "peer-checked:border-rs-primary-500 peer-checked:bg-rs-primary-500 peer-checked:shadow-[0_8px_18px_-12px_rgba(0,112,224,0.9)]",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        )}
      >
        {indeterminate ? (
          <Minus className="size-3.5 transition-all duration-200 ease-out" />
        ) : (
          <Check
            className={cn(
              "size-3.5 transition-all duration-200 ease-out",
              checked ? "scale-100 opacity-100" : "scale-75 opacity-0"
            )}
          />
        )}
      </span>
    </label>
  );
}

export function PeopleTable({ initialFilter }: { initialFilter?: StatusFilter }) {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilter ?? "active");
  const [savedViews, setSavedViews] = useState<SavedView[]>(loadSavedViews);
  const [loading, setLoading] = useState(true);

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/people?includeInactive=true");
      const data = await res.json();
      setPeople(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const filtered = people.filter((p) => {
    // Status filter
    if (statusFilter === "active" && !p.isActive) return false;
    if (statusFilter === "inactive" && p.isActive) return false;

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      (p.departmentName && p.departmentName.toLowerCase().includes(q))
    );
  });

  const visibleRows = useMemo(() => {
    const rows = [...filtered];

    if (sortColumn === "person" || sortColumn === "person-desc") {
      const dir = sortColumn === "person" ? 1 : -1;
      rows.sort((a, b) => {
        const firstNameCompare = compareNames(getFirstName(a.name), getFirstName(b.name));
        if (firstNameCompare !== 0) return firstNameCompare * dir;
        return compareNames(a.name, b.name) * dir;
      });
      return rows;
    }

    if (sortColumn === "title" || sortColumn === "title-desc") {
      const dir = sortColumn === "title" ? 1 : -1;
      rows.sort((a, b) => {
        const rankCompare = (getTitleRank(b.title) - getTitleRank(a.title)) * dir;
        if (rankCompare !== 0) return rankCompare;
        const titleCompare = compareNames(a.title, b.title) * dir;
        if (titleCompare !== 0) return titleCompare;
        return compareNames(a.name, b.name);
      });
      return rows;
    }

    if (sortColumn === "department" || sortColumn === "department-desc") {
      const dir = sortColumn === "department" ? 1 : -1;
      rows.sort((a, b) => {
        const deptA = a.departmentName || "Other";
        const deptB = b.departmentName || "Other";
        const deptCompare = compareNames(deptA, deptB) * dir;
        if (deptCompare !== 0) return deptCompare;

        const rankCompare = getTitleRank(b.title) - getTitleRank(a.title);
        if (rankCompare !== 0) return rankCompare;

        return compareNames(a.name, b.name);
      });
    }

    return rows;
  }, [filtered, sortColumn]);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const lastClickedIndexRef = useRef<number | null>(null);
  const [editingPerson, setEditingPerson] = useState<PersonRow | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const [deleteIntent, setDeleteIntent] = useState<{
    ids: number[];
    title: string;
    description: string;
  } | null>(null);

  // Clear selection when search changes
  useEffect(() => { setSelected(new Set()); }, [search]);

  const toggleSortColumn = useCallback((column: "person" | "title" | "department") => {
    setSortColumn((prev) => {
      if (column === "person") {
        if (prev === "person") return "person-desc";
        if (prev === "person-desc") return null;
        return "person";
      }
      if (column === "title") {
        if (prev === "title") return "title-desc";
        if (prev === "title-desc") return null;
        return "title";
      }
      if (column === "department") {
        if (prev === "department") return "department-desc";
        if (prev === "department-desc") return null;
        return "department";
      }
      return prev === column ? null : column;
    });
  }, []);

  const sortLabel =
    sortColumn === "person" ? "Person A-Z"
    : sortColumn === "person-desc" ? "Person Z-A"
    : sortColumn === "title" ? "Title · Senior first"
    : sortColumn === "title-desc" ? "Title · Junior first"
    : sortColumn === "department" ? "Department A-Z"
    : sortColumn === "department-desc" ? "Department Z-A"
    : null;

  const hasActiveFilters = sortColumn !== null || statusFilter !== "all";

  // Check if current filters already match a saved view
  const currentViewMatch = savedViews.find(
    (v) => v.sort === sortColumn && v.status === statusFilter
  );

  function buildViewName(sort: SortColumn, status: StatusFilter): string {
    const parts: string[] = [];
    if (sort === "person") parts.push("Name A-Z");
    else if (sort === "person-desc") parts.push("Name Z-A");
    else if (sort === "title") parts.push("Senior first");
    else if (sort === "title-desc") parts.push("Junior first");
    else if (sort === "department") parts.push("Dept A-Z");
    else if (sort === "department-desc") parts.push("Dept Z-A");
    if (status === "active") parts.push("Active");
    else if (status === "inactive") parts.push("Inactive");
    return parts.join(" + ") || "All";
  }

  function handleSaveView() {
    if (currentViewMatch) return;
    const view: SavedView = {
      id: Date.now().toString(36),
      name: buildViewName(sortColumn, statusFilter),
      sort: sortColumn,
      status: statusFilter,
    };
    const next = [...savedViews, view];
    setSavedViews(next);
    persistSavedViews(next);
  }

  function handleApplyView(view: SavedView) {
    setSortColumn(view.sort);
    setStatusFilter(view.status);
  }

  function handleDeleteView(id: string) {
    const next = savedViews.filter((v) => v.id !== id);
    setSavedViews(next);
    persistSavedViews(next);
  }

  const toggleSelect = useCallback((id: number, shiftKey = false) => {
    const currentIndex = visibleRows.findIndex((p) => p.id === id);

    if (shiftKey && lastClickedIndexRef.current !== null && lastClickedIndexRef.current !== currentIndex) {
      const from = Math.min(lastClickedIndexRef.current, currentIndex);
      const to = Math.max(lastClickedIndexRef.current, currentIndex);
      const rangeIds = visibleRows.slice(from, to + 1).map((p) => p.id);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const rid of rangeIds) next.add(rid);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    }

    lastClickedIndexRef.current = currentIndex;
  }, [visibleRows]);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === visibleRows.length) return new Set();
      return new Set(visibleRows.map((p) => p.id));
    });
  }, [visibleRows]);

  async function handleBulkActivate() {
    if (bulkBusy) return;
    setBulkBusy(true);
    const ids = [...selected];
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/people/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: true }),
          })
        )
      );
      setSelected(new Set());
      await fetchPeople();
      toast.success(`${ids.length} ${ids.length === 1 ? "person" : "people"} activated`);
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkDeactivate() {
    if (bulkBusy) return;
    setBulkBusy(true);
    const ids = [...selected];
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/people/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: false }),
          })
        )
      );
      setSelected(new Set());
      await fetchPeople();
      toast.success(`${ids.length} ${ids.length === 1 ? "person" : "people"} deactivated`);
    } finally {
      setBulkBusy(false);
    }
  }

  function handleBulkDelete() {
    if (bulkBusy) return;
    const count = selected.size;
    setDeleteIntent({
      ids: [...selected],
      title: `Delete ${count} ${count === 1 ? "person" : "people"}?`,
      description: "This will deactivate the selected people. You can undo this action.",
    });
  }

  async function handleToggle(id: number) {
    if (togglingIds.has(id)) return; // prevent rapid clicks
    const current = people.find((person) => person.id === id);
    if (!current) return;
    const nextIsActive = !current.isActive;

    setTogglingIds((prev) => new Set(prev).add(id));

    // Optimistic update — flip locally first, then sync with server
    setPeople((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p))
    );

    try {
      const res = await fetch(`/api/people/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextIsActive }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      // Sync with server's definitive state
      const updated = await res.json();
      setPeople((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isActive: updated.isActive } : p))
      );
      toast.success(`${current.name} ${nextIsActive ? "activated" : "deactivated"}`);
    } catch {
      // Revert on failure
      setPeople((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p))
      );
      toast.error("Failed to update status");
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function handleDelete(person: PersonRow) {
    setDeleteIntent({
      ids: [person.id],
      title: `Delete ${person.name}?`,
      description: "This will deactivate this person. You can undo this action.",
    });
  }

  async function confirmDelete() {
    if (!deleteIntent || bulkBusy) return;
    setBulkBusy(true);
    try {
      const count = deleteIntent.ids.length;
      const ids = [...deleteIntent.ids];
      // Soft-delete: deactivate instead of permanently removing
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/people/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: false }),
          })
        )
      );
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setDeleteIntent(null);
      await fetchPeople();
      toast.success(
        `${count} ${count === 1 ? "person" : "people"} deactivated`,
        {
          action: {
            label: "Undo",
            onClick: async () => {
              await Promise.all(
                ids.map((id) =>
                  fetch(`/api/people/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isActive: true }),
                  })
                )
              );
              await fetchPeople();
              toast.success(`${count} ${count === 1 ? "person" : "people"} reactivated`);
            },
          },
        }
      );
    } finally {
      setBulkBusy(false);
    }
  }

  function handleExportCsv() {
    const csvHeader = ["Name", "Title", "Department", "Status", "Reports To"];
    const csvRows = visibleRows.map((row) => {
      const reportsToName = row.reportsTo
        ? people.find((p) => p.id === row.reportsTo)?.name ?? ""
        : "";
      return [
        row.name,
        row.title,
        row.departmentName ?? "",
        row.isActive ? "Active" : "Inactive",
        reportsToName,
      ].map((field) => {
        if (/[",\n\r]/.test(field)) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      });
    });

    const csvContent = [csvHeader.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "people-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">People</h1>
          <p className="text-sm text-muted-foreground">
            Manage the people in your org chart
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={visibleRows.length === 0}
            className="cursor-pointer transition-all duration-200"
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
          <PersonForm
            onSave={fetchPeople}
            trigger={
              <Button className="cursor-pointer transition-all duration-200">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Add Person</span>
                <span className="sm:hidden">Add</span>
              </Button>
            }
          />
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, title, or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>
      {/* Filters & suggestions */}
      {!search && people.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {/* Active filter chips */}
          {sortLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border bg-muted/60 pl-2.5 pr-0.5 py-0.5 text-foreground animate-in fade-in slide-in-from-left-1 duration-200">
              <button
                type="button"
                onClick={() => {
                  if (sortColumn === "person") setSortColumn("person-desc");
                  else if (sortColumn === "person-desc") setSortColumn("person");
                  else if (sortColumn === "title") setSortColumn("title-desc");
                  else if (sortColumn === "title-desc") setSortColumn("title");
                  else if (sortColumn === "department") setSortColumn("department-desc");
                  else if (sortColumn === "department-desc") setSortColumn("department");
                }}
                className="inline-flex items-center gap-1.5 cursor-pointer transition-colors hover:text-rs-primary-600 dark:hover:text-rs-primary-400"
              >
                {(sortColumn === "person") && <ArrowUpAZ className="size-3 text-muted-foreground" />}
                {(sortColumn === "person-desc") && <ArrowDownZA className="size-3 text-muted-foreground" />}
                {(sortColumn === "title") && <ArrowDownUp className="size-3 text-muted-foreground" />}
                {(sortColumn === "title-desc") && <ArrowUpDown className="size-3 text-muted-foreground" />}
                {(sortColumn === "department") && <ArrowUpAZ className="size-3 text-muted-foreground" />}
                {(sortColumn === "department-desc") && <ArrowDownZA className="size-3 text-muted-foreground" />}
                <span className="font-medium">{sortLabel}</span>
              </button>
              <button
                type="button"
                aria-label="Remove sort filter"
                onClick={() => setSortColumn(null)}
                className="ml-0.5 rounded-full p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          )}
          {statusFilter !== "all" && (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full border pl-2.5 pr-0.5 py-0.5 animate-in fade-in slide-in-from-left-1 duration-200",
              statusFilter === "active"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-border bg-muted/60 text-muted-foreground"
            )}>
              <button
                type="button"
                onClick={() => setStatusFilter((prev) => prev === "active" ? "inactive" : "active")}
                className="inline-flex items-center gap-1.5 cursor-pointer transition-colors hover:opacity-80"
              >
                {statusFilter === "active"
                  ? <CircleDot className="size-3" />
                  : <CircleOff className="size-3" />}
                <span className="font-medium">
                  {statusFilter === "active" ? "Active" : "Inactive"}
                </span>
              </button>
              <button
                type="button"
                aria-label="Remove status filter"
                onClick={() => setStatusFilter("all")}
                className="ml-0.5 rounded-full p-1 transition-colors hover:bg-background/60 hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {/* Save view button */}
          {hasActiveFilters && !currentViewMatch && (
            <button
              type="button"
              onClick={handleSaveView}
              title="Save current filter as a view"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-rs-primary-500/30 px-2.5 py-1 text-rs-primary-600 transition-colors hover:border-rs-primary-500/50 hover:bg-rs-primary-500/5 dark:text-rs-primary-400 cursor-pointer"
            >
              <Bookmark className="size-3" />
              Save view
            </button>
          )}
          {hasActiveFilters && currentViewMatch && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-muted-foreground" title="This view is saved">
              <BookmarkCheck className="size-3" />
              Saved
            </span>
          )}

          {/* Separator between active chips and suggestions */}
          {(sortLabel || statusFilter !== "all") && <div className="w-px h-4 bg-border mx-1" />}

          {/* Suggested filters — only show what's not already active */}
          {!sortColumn && (
            <>
              <button
                type="button"
                onClick={() => setSortColumn("person")}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground"
              >
                <ArrowUpAZ className="size-3" />
                Name A-Z
              </button>
              <button
                type="button"
                onClick={() => setSortColumn("title")}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground"
              >
                <ArrowDownUp className="size-3" />
                By rank
              </button>
              <button
                type="button"
                onClick={() => setSortColumn("department")}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground"
              >
                <Group className="size-3" />
                By department
              </button>
            </>
          )}
          {statusFilter === "all" && people.some((p) => !p.isActive) && (
            <button
              type="button"
              onClick={() => setStatusFilter("inactive")}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground"
            >
              <CircleOff className="size-3" />
              Inactive
            </button>
          )}
          {statusFilter === "all" && (
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground"
            >
              <CircleDot className="size-3" />
              Active
            </button>
          )}

          {/* Saved views */}
          {savedViews.length > 0 && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              {savedViews.map((view) => {
                const isActive = view.sort === sortColumn && view.status === statusFilter;
                return (
                  <span
                    key={view.id}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border pl-2.5 pr-0.5 py-0.5 transition-colors",
                      isActive
                        ? "border-rs-primary-500/30 bg-rs-primary-500/10 text-rs-primary-600 dark:text-rs-primary-400"
                        : "border-border bg-background text-muted-foreground"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleApplyView(view)}
                      className="inline-flex items-center gap-1.5 cursor-pointer transition-colors hover:text-foreground"
                    >
                      <BookmarkCheck className="size-3" />
                      <span className="font-medium">{view.name}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove saved view: ${view.name}`}
                      onClick={() => handleDeleteView(view.id)}
                      className="ml-0.5 rounded-full p-1 transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-rs-primary-500/30 bg-rs-primary-500/5 px-4 py-2.5 animate-in fade-in slide-in-from-top-1">
          <span className="text-sm font-medium text-foreground">
            {selected.size} selected
          </span>
          <div className="w-px h-5 bg-border" />
          <Button
            variant="ghost"
            size="sm"
            disabled={bulkBusy}
            onClick={handleBulkActivate}
            className="text-emerald-600 hover:text-emerald-500 hover:bg-emerald-500/10 dark:text-emerald-400 cursor-pointer"
          >
            <CheckCircle2 className="size-4" />
            Activate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={bulkBusy}
            onClick={handleBulkDeactivate}
            className="text-amber-600 hover:text-amber-500 hover:bg-amber-500/10 dark:text-amber-400 cursor-pointer"
          >
            <XCircle className="size-4" />
            Deactivate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={bulkBusy}
            onClick={handleBulkDelete}
            className="text-red-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSelected(new Set())}
            title="Clear selection"
            className="cursor-pointer"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-10 px-3 py-2"><div className="size-5 rounded-md bg-muted animate-pulse" /></th>
                <th className="px-3 py-2 text-left"><div className="h-4 w-16 rounded bg-muted animate-pulse" /></th>
                <th className="px-3 py-2 text-left"><div className="h-4 w-12 rounded bg-muted animate-pulse" /></th>
                <th className="px-3 py-2 text-left"><div className="h-4 w-20 rounded bg-muted animate-pulse" /></th>
                <th className="px-3 py-2 text-left"><div className="h-4 w-14 rounded bg-muted animate-pulse" /></th>
                {/* Actions column removed */}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="w-10 px-3 py-2"><div className="size-5 rounded-md bg-muted animate-pulse" /></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-muted animate-pulse shrink-0" />
                      <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                    </div>
                  </td>
                  <td className="px-3 py-2"><div className="h-4 w-24 rounded bg-muted animate-pulse" /></td>
                  <td className="px-3 py-2"><div className="h-5 w-20 rounded-full bg-muted animate-pulse" /></td>
                  <td className="px-3 py-2"><div className="h-5 w-14 rounded-full bg-muted animate-pulse" /></td>
                  {/* Actions column removed */}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Users className="size-6 text-muted-foreground" />
          </div>
          {search ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No results found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No people yet</p>
              <p className="text-sm text-muted-foreground">Add your first team member to get started.</p>
            </div>
          )}
          {!search && (
            <PersonForm
              onSave={fetchPeople}
              trigger={
                <Button variant="outline" size="sm" className="mt-1 cursor-pointer">
                  <Plus className="size-4" />
                  Add Person
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-10 px-3 py-2">
                  <SmoothCheckbox
                    checked={visibleRows.length > 0 && selected.size === visibleRows.length}
                    indeterminate={selected.size > 0 && selected.size < visibleRows.length}
                    onChange={toggleSelectAll}
                    ariaLabel="Select all people"
                  />
                </th>
                <th
                  className="px-3 py-2 text-left font-medium"
                  aria-sort={sortColumn === "person" ? "ascending" : sortColumn === "person-desc" ? "descending" : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleSortColumn("person")}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-1.5 py-1 cursor-pointer transition-colors hover:bg-muted",
                      (sortColumn === "person" || sortColumn === "person-desc") && "bg-rs-primary-500/10 text-rs-primary-600 dark:text-rs-primary-300"
                    )}
                  >
                    Person
                    {sortColumn === "person"
                      ? <ArrowUpAZ className="size-3.5" />
                      : sortColumn === "person-desc"
                        ? <ArrowDownZA className="size-3.5" />
                        : null}
                  </button>
                </th>
                <th
                  className="hidden sm:table-cell px-3 py-2 text-left font-medium"
                  aria-sort={sortColumn === "title" ? "ascending" : sortColumn === "title-desc" ? "descending" : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleSortColumn("title")}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-1.5 py-1 cursor-pointer transition-colors hover:bg-muted",
                      (sortColumn === "title" || sortColumn === "title-desc") && "bg-rs-primary-500/10 text-rs-primary-600 dark:text-rs-primary-300"
                    )}
                  >
                    Title
                    {sortColumn === "title"
                      ? <ArrowDownUp className="size-3.5" />
                      : sortColumn === "title-desc"
                        ? <ArrowUpDown className="size-3.5" />
                        : null}
                  </button>
                </th>
                <th
                  className="hidden md:table-cell px-3 py-2 text-left font-medium"
                  aria-sort={sortColumn === "department" ? "ascending" : sortColumn === "department-desc" ? "descending" : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleSortColumn("department")}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-1.5 py-1 cursor-pointer transition-colors hover:bg-muted",
                      (sortColumn === "department" || sortColumn === "department-desc") && "bg-rs-primary-500/10 text-rs-primary-600 dark:text-rs-primary-300"
                    )}
                  >
                    Department
                    {sortColumn === "department"
                      ? <ArrowUpAZ className="size-3.5" />
                      : sortColumn === "department-desc"
                        ? <ArrowDownZA className="size-3.5" />
                        : null}
                  </button>
                </th>
                <th className="hidden sm:table-cell px-3 py-2 text-left font-medium">
                  <button
                    type="button"
                    onClick={() => setStatusFilter((prev) =>
                      prev === "active" ? "inactive" : prev === "inactive" ? "all" : "active"
                    )}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-1.5 py-1 cursor-pointer transition-colors hover:bg-muted",
                      statusFilter !== "all" && "bg-rs-primary-500/10 text-rs-primary-600 dark:text-rs-primary-300"
                    )}
                  >
                    Status
                    {statusFilter === "active"
                      ? <CircleDot className="size-3.5 text-emerald-500" />
                      : statusFilter === "inactive"
                        ? <CircleOff className="size-3.5" />
                        : <ListFilter className="size-3.5 opacity-40" />}
                  </button>
                </th>
                {/* Actions column removed — row click opens edit */}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((person) => (
                <tr
                  key={person.id}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    // Don't do anything if clicking interactive elements
                    if (target.closest("button, input, a, [role=menuitem]")) return;
                    // Checkbox column click → toggle selection
                    if (target.closest("td")?.cellIndex === 0) {
                      toggleSelect(person.id, e.shiftKey);
                      return;
                    }
                    // Anywhere else → open edit
                    setEditingPerson(person);
                  }}
                  className={cn(
                    "border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-all duration-200",
                    selected.has(person.id) && "bg-rs-primary-500/5",
                    !person.isActive && "opacity-50"
                  )}
                >
                  {/* Checkbox */}
                  <td className="w-10 px-3 py-2">
                    <SmoothCheckbox
                      checked={selected.has(person.id)}
                      onChange={(shiftKey) => toggleSelect(person.id, shiftKey)}
                      ariaLabel={`Select ${person.name}`}
                    />
                  </td>

                  {/* Person */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar size="default">
                        {person.photoUrl && (
                          <AvatarImage src={person.photoUrl} alt={person.name} />
                        )}
                        <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">{person.name}</span>
                        <span className="sm:hidden text-xs text-muted-foreground">{person.title}</span>
                      </div>
                    </div>
                  </td>

                  {/* Title */}
                  <td className="hidden sm:table-cell px-3 py-2 text-muted-foreground">{person.title}</td>

                  {/* Department */}
                  <td className="hidden md:table-cell px-3 py-2">
                    <DepartmentBadge
                      departmentName={person.departmentName}
                      departmentColor={person.departmentColor}
                    />
                  </td>

                  {/* Status — clickable toggle pill */}
                  <td className="hidden sm:table-cell px-3 py-2">
                    <button
                      onClick={() => handleToggle(person.id)}
                      disabled={togglingIds.has(person.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-all duration-200 border disabled:opacity-75 disabled:cursor-not-allowed ${
                        person.isActive
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-400/20"
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      }`}
                      title={person.isActive ? "Click to deactivate" : "Click to activate"}
                    >
                      <span className={`inline-block size-1.5 rounded-full ${
                        person.isActive ? "bg-emerald-500 dark:bg-emerald-400" : "bg-muted-foreground"
                      }`} />
                      {person.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>

                  {/* Actions column removed — row click opens edit, delete via bulk actions */}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Count footer */}
      {!loading && (
        <p className="text-xs text-muted-foreground tabular-nums">
          Showing {visibleRows.length} of {people.length} people
        </p>
      )}

      {/* Row-click edit dialog */}
      {editingPerson && (
        <PersonForm
          person={editingPerson}
          onSave={() => { setEditingPerson(null); fetchPeople(); }}
          open={true}
          onOpenChange={(isOpen) => { if (!isOpen) setEditingPerson(null); }}
        />
      )}

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
