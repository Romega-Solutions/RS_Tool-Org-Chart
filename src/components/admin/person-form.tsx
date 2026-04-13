"use client";
import { useState, useEffect, useRef } from "react";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDeptIcon } from "@/lib/dept-icons";
import type { Person, Department } from "@/types";

interface PersonWithDept extends Person {
  departmentName: string | null;
  departmentColor: string | null;
}

interface Props {
  person?: PersonWithDept;
  onSave: () => void;
  trigger: React.ReactNode;
}

export function PersonForm({ person, onSave, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [reportsTo, setReportsTo] = useState<number | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [allPeople, setAllPeople] = useState<PersonWithDept[]>([]);
  const [reportsToSearch, setReportsToSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(person?.name || "");
      setTitle(person?.title || "");
      setDepartmentId(person?.departmentId ?? null);
      setReportsTo(person?.reportsTo ?? null);
      setPhotoUrl(person?.photoUrl ?? null);
      setPhotoPreview(person?.photoUrl ?? null);

      fetch("/api/departments")
        .then((r) => r.json())
        .then(setDepartments);

      fetch("/api/people")
        .then((r) => r.json())
        .then(setAllPeople);
    }
  }, [open, person]);

  const filteredPeople = allPeople
    .filter((p) => (person ? p.id !== person.id : true))
    .filter(
      (p) =>
        !reportsToSearch ||
        p.name.toLowerCase().includes(reportsToSearch.toLowerCase()) ||
        p.title.toLowerCase().includes(reportsToSearch.toLowerCase())
    );

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoPreview(URL.createObjectURL(file));
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setPhotoUrl(data.url);
      }
    } catch {
      setPhotoPreview(photoUrl);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !title.trim()) return;
    setSaving(true);

    const url = person ? `/api/people/${person.id}` : "/api/people";
    const method = person ? "PATCH" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        title: title.trim(),
        departmentId,
        reportsTo,
        photoUrl,
      }),
    });

    setSaving(false);
    setOpen(false);

    if (!person) {
      setName("");
      setTitle("");
      setDepartmentId(null);
      setReportsTo(null);
      setPhotoUrl(null);
      setPhotoPreview(null);
    }

    onSave();
  }

  const reportsToLabel = reportsTo
    ? allPeople.find((p) => p.id === reportsTo)?.name ?? "Select manager"
    : "None (top-level)";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement}>{}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{person ? "Edit Person" : "Add Person"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo */}
          <div className="space-y-2">
            <Label>Photo</Label>
            <div className="flex items-center gap-3">
              {photoPreview ? (
                <NextImage
                  src={photoPreview}
                  alt="Preview"
                  width={48}
                  height={48}
                  className="size-12 rounded-full object-cover border"
                />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">
                  {name
                    ? name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "?"}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? "Uploading..." : "Choose Photo"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                {photoUrl && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground text-left"
                    onClick={() => {
                      setPhotoUrl(null);
                      setPhotoPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="person-name">Name *</Label>
            <Input
              id="person-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              required
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="person-title">Title *</Label>
            <Input
              id="person-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Software Engineer"
              required
            />
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label>Department</Label>
            <Select
              value={departmentId ?? undefined}
              onValueChange={(val) => setDepartmentId(val as number)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => {
                  const DeptIcon = getDeptIcon(d.name);
                  return (
                  <SelectItem key={d.id} value={d.id}>
                    <DeptIcon
                      className="mr-1.5 inline-block size-3"
                      style={{ color: d.color || "#888" }}
                    />
                    {d.name}
                  </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Reports To */}
          <div className="space-y-2">
            <Label>Reports To</Label>
            <div className="space-y-1.5">
              <Input
                placeholder="Search by name or title..."
                value={reportsToSearch}
                onChange={(e) => setReportsToSearch(e.target.value)}
              />
              <div className="max-h-32 overflow-y-auto rounded-md border">
                <button
                  type="button"
                  className={`flex w-full items-center px-2 py-1.5 text-sm hover:bg-muted ${
                    reportsTo === null ? "bg-muted font-medium" : ""
                  }`}
                  onClick={() => setReportsTo(null)}
                >
                  None (top-level)
                </button>
                {filteredPeople.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted ${
                      reportsTo === p.id ? "bg-muted font-medium" : ""
                    }`}
                    onClick={() => setReportsTo(p.id)}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-muted-foreground text-xs truncate">
                      {p.title}
                    </span>
                  </button>
                ))}
                {filteredPeople.length === 0 && reportsToSearch && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No matches
                  </div>
                )}
              </div>
              {reportsTo !== null && (
                <p className="text-xs text-muted-foreground">
                  Selected: {reportsToLabel}
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving || uploading}
            className="w-full"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
