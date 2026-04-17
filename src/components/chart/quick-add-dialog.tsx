"use client";
import { useState, useEffect, useCallback } from "react";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    fetch("/api/departments")
      .then((r) => r.json())
      .then(setDepartments)
      .catch(() => setError("Failed to load departments"));
    fetch("/api/people")
      .then((r) => r.json())
      .then(setPeople)
      .catch(() => {/* non-critical, reports-to list just stays empty */});
  }, [open]);

  const reset = useCallback(() => {
    setName("");
    setTitle("");
    setDepartmentId(null);
    setReportsTo(null);
    setError(null);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !title.trim() || departmentId === null) return;
    setSaving(true);
    setError(null);
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
      const result = await res.json() as { id: number };
      if (typeof result.id !== "number") throw new Error("Unexpected response");
      reset();
      onOpenChange(false);
      onSaved(result.id);
    } catch {
      setError("Failed to save. Please try again.");
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
              onValueChange={(v) => setDepartmentId(v ? Number(v) : null)}
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
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
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
