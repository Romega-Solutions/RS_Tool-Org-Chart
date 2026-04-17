"use client";
import { useState, useEffect, useCallback, useMemo, createElement } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PersonForm } from "@/components/admin/person-form";
import { Pencil, Trash2, Plus, Search, CheckCircle2, XCircle, X, Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDeptIcon } from "@/lib/dept-icons";
import type { Person } from "@/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface PersonRow extends Person {
  departmentName: string | null;
  departmentColor: string | null;
}

type SortColumn = "person" | "title" | "department" | null;

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

  if (
    value.includes("chief") ||
    value.includes("ceo") ||
    value.includes("coo") ||
    value.includes("cto") ||
    value.includes("cfo") ||
    value.includes("cio") ||
    value.includes("cmo") ||
    value.includes("founder") ||
    value.includes("president")
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
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <label
      className="group relative inline-flex cursor-pointer items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        aria-label={ariaLabel}
        aria-checked={indeterminate ? "mixed" : checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={onChange}
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

export function PeopleTable() {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
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

    if (sortColumn === "person") {
      rows.sort((a, b) => {
        const firstNameCompare = compareNames(getFirstName(a.name), getFirstName(b.name));
        if (firstNameCompare !== 0) return firstNameCompare;
        return compareNames(a.name, b.name);
      });
      return rows;
    }

    if (sortColumn === "title") {
      rows.sort((a, b) => {
        const rankCompare = getTitleRank(b.title) - getTitleRank(a.title);
        if (rankCompare !== 0) return rankCompare;
        const titleCompare = compareNames(a.title, b.title);
        if (titleCompare !== 0) return titleCompare;
        return compareNames(a.name, b.name);
      });
      return rows;
    }

    if (sortColumn === "department") {
      rows.sort((a, b) => {
        const deptA = a.departmentName || "Other";
        const deptB = b.departmentName || "Other";
        const deptCompare = compareNames(deptA, deptB);
        if (deptCompare !== 0) return deptCompare;

        const rankCompare = getTitleRank(b.title) - getTitleRank(a.title);
        if (rankCompare !== 0) return rankCompare;

        return compareNames(a.name, b.name);
      });
    }

    return rows;
  }, [filtered, sortColumn]);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const [deleteIntent, setDeleteIntent] = useState<{
    ids: number[];
    title: string;
    description: string;
  } | null>(null);

  // Clear selection when search changes
  useEffect(() => { setSelected(new Set()); }, [search]);

  const toggleSortColumn = useCallback((column: Exclude<SortColumn, null>) => {
    setSortColumn((prev) => (prev === column ? null : column));
  }, []);

  const sortLabel =
    sortColumn === "person"
      ? "Person A-Z"
      : sortColumn === "title"
        ? "Title high-low"
        : sortColumn === "department"
          ? "Department grouped"
          : null;

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

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
      description: "This action permanently removes the selected people and cannot be undone.",
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
    } catch {
      // Revert on failure
      setPeople((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p))
      );
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
      description: "This action permanently removes this person and cannot be undone.",
    });
  }

  async function confirmDelete() {
    if (!deleteIntent || bulkBusy) return;
    setBulkBusy(true);
    try {
      await Promise.all(deleteIntent.ids.map((id) => fetch(`/api/people/${id}`, { method: "DELETE" })));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of deleteIntent.ids) next.delete(id);
        return next;
      });
      setDeleteIntent(null);
      await fetchPeople();
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">People</h1>
          <p className="text-sm text-muted-foreground">
            Manage the people in your org chart
          </p>
        </div>
        <PersonForm
          onSave={fetchPeople}
          trigger={
            <Button className="cursor-pointer transition-all duration-200">
              <Plus className="size-4" />
              Add Person
            </Button>
          }
        />
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
      {sortLabel && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Sorted by:
            {" "}
            <span className="font-medium text-foreground">{sortLabel}</span>
          </span>
          <button
            type="button"
            onClick={() => setSortColumn(null)}
            className="rounded-md px-2 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Clear
          </button>
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
        <div className="py-8 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {search ? "No people match your search." : "No people yet. Add one to get started."}
        </div>
      ) : (
        <div className="rounded-lg border">
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
                <th className="px-3 py-2 text-left font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSortColumn("person")}
                    className={cn(
                      "rounded-md px-1.5 py-1 transition-colors hover:bg-muted",
                      sortColumn === "person" && "bg-rs-primary-500/10 text-rs-primary-600 dark:text-rs-primary-300"
                    )}
                  >
                    Person
                    {sortColumn === "person" ? " · A-Z" : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSortColumn("title")}
                    className={cn(
                      "rounded-md px-1.5 py-1 transition-colors hover:bg-muted",
                      sortColumn === "title" && "bg-rs-primary-500/10 text-rs-primary-600 dark:text-rs-primary-300"
                    )}
                  >
                    Title
                    {sortColumn === "title" ? " · High-Low" : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSortColumn("department")}
                    className={cn(
                      "rounded-md px-1.5 py-1 transition-colors hover:bg-muted",
                      sortColumn === "department" && "bg-rs-primary-500/10 text-rs-primary-600 dark:text-rs-primary-300"
                    )}
                  >
                    Department
                    {sortColumn === "department" ? " · Grouped" : ""}
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((person) => (
                <tr
                  key={person.id}
                  onClick={(e) => {
                    // Don't toggle selection if clicking buttons, inputs, or links
                    const target = e.target as HTMLElement;
                    if (target.closest("button, input, a, [role=menuitem]")) return;
                    toggleSelect(person.id);
                  }}
                  className={cn(
                    "border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-all duration-200",
                    selected.has(person.id) && "bg-rs-primary-500/5"
                  )}
                >
                  {/* Checkbox */}
                  <td className="w-10 px-3 py-2">
                    <SmoothCheckbox
                      checked={selected.has(person.id)}
                      onChange={() => toggleSelect(person.id)}
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
                      <span className="font-medium">{person.name}</span>
                    </div>
                  </td>

                  {/* Title */}
                  <td className="px-3 py-2 text-muted-foreground">{person.title}</td>

                  {/* Department */}
                  <td className="px-3 py-2">
                    <DepartmentBadge
                      departmentName={person.departmentName}
                      departmentColor={person.departmentColor}
                    />
                  </td>

                  {/* Status — clickable toggle pill */}
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleToggle(person.id)}
                      disabled={togglingIds.has(person.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-all duration-200 border disabled:opacity-50 disabled:cursor-not-allowed ${
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

                  {/* Actions */}
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <PersonForm
                        person={person}
                        onSave={fetchPeople}
                        trigger={
                          <Button variant="ghost" size="icon-sm" title="Edit" className="cursor-pointer transition-all duration-200">
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete"
                        onClick={() => handleDelete(person)}
                        className="cursor-pointer hover:bg-destructive/10 transition-all duration-200"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Count footer */}
      {!loading && (
        <p className="text-xs text-muted-foreground">
          Showing {visibleRows.length} of {people.length} people
        </p>
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
