"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PersonForm } from "@/components/admin/person-form";
import { Pencil, Trash2, Plus, Search, CheckCircle2, XCircle, X } from "lucide-react";
import { getDeptIcon } from "@/lib/dept-icons";
import type { Person } from "@/types";

interface PersonRow extends Person {
  departmentName: string | null;
  departmentColor: string | null;
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
  const DeptIcon = getDeptIcon(departmentName);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: departmentColor ? `${departmentColor}18` : "#88888818",
        color: departmentColor || "#888",
        border: `1px solid ${departmentColor ? `${departmentColor}30` : "#88888830"}`,
      }}
    >
      <DeptIcon className="size-3" />
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

export function PeopleTable() {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [search, setSearch] = useState("");
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

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  // Clear selection when search changes
  useEffect(() => { setSelected(new Set()); }, [search]);

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map((p) => p.id));
    });
  }, [filtered]);

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

  async function handleBulkDelete() {
    if (bulkBusy) return;
    const count = selected.size;
    if (!confirm(`Delete ${count} ${count === 1 ? "person" : "people"}? This cannot be undone.`)) return;
    setBulkBusy(true);
    const ids = [...selected];
    try {
      await Promise.all(ids.map((id) => fetch(`/api/people/${id}`, { method: "DELETE" })));
      setSelected(new Set());
      await fetchPeople();
    } finally {
      setBulkBusy(false);
    }
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

  async function handleDelete(person: PersonRow) {
    if (!confirm(`Delete "${person.name}"? This action cannot be undone.`)) return;
    await fetch(`/api/people/${person.id}`, { method: "DELETE" });
    fetchPeople();
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
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {search ? "No people match your search." : "No people yet. Add one to get started."}
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < filtered.length; }}
                    onChange={toggleSelectAll}
                    className="size-4 rounded border-border accent-rs-primary-500 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium">Person</th>
                <th className="px-3 py-2 text-left font-medium">Title</th>
                <th className="px-3 py-2 text-left font-medium">Department</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((person) => (
                <tr
                  key={person.id}
                  className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-all duration-200"
                >
                  {/* Checkbox */}
                  <td className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(person.id)}
                      onChange={() => toggleSelect(person.id)}
                      className="size-4 rounded border-border accent-rs-primary-500 cursor-pointer"
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
          Showing {filtered.length} of {people.length} people
        </p>
      )}
    </div>
  );
}
