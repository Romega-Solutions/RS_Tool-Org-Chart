"use client";
import { createElement, useState, useEffect, useRef } from "react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
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

function getInitials(value: string) {
  return value
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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
  const managerGroups = allPeople
    .filter((p) => (person ? p.id !== person.id : true))
    .reduce((map, currentPerson) => {
      const groupName = currentPerson.departmentName || "Other";
      const existing = map.get(groupName) ?? [];
      existing.push(currentPerson);
      map.set(groupName, existing);
      return map;
    }, new Map<string, PersonWithDept[]>());

  const sortedManagerGroups = Array.from(managerGroups.entries())
    .sort(([groupA], [groupB]) => {
      if (groupA === "Other") return 1;
      if (groupB === "Other") return -1;
      return groupA.localeCompare(groupB);
    })
    .map(([groupName, peopleInGroup]) => ({
      groupName,
      people: peopleInGroup.sort((a, b) => a.name.localeCompare(b.name)),
    }));

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
                    ? getInitials(name)
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
          {/* Department */}
          <div className="space-y-2">
            <Label>Department</Label>
            <Select
              value={departmentId != null ? String(departmentId) : ""}
              onValueChange={(val) => setDepartmentId(Number(val))}
            >
              <SelectTrigger className="w-full">
                {departmentId != null ? (() => {
                  const dept = departments.find((d) => d.id === departmentId);
                  if (!dept) return <span className="text-muted-foreground">Select department</span>;
                  return (
                    <span className="flex items-center gap-1.5">
                      {createElement(getDeptIcon(dept.name), {
                        className: "size-3",
                        style: { color: dept.color || "#888" },
                      })}
                      {dept.name}
                    </span>
                  );
                })() : (
                  <span className="text-muted-foreground">Select department</span>
                )}
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {createElement(getDeptIcon(d.name), {
                      className: "mr-1.5 inline-block size-3",
                      style: { color: d.color || "#888" },
                    })}
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reports To */}
          <div className="space-y-2">
            <Label>Reports To</Label>
            <Select
              value={reportsTo != null ? String(reportsTo) : "none"}
              onValueChange={(value) =>
                setReportsTo(value === "none" ? null : Number(value))
              }
            >
              <SelectTrigger className="w-full">
                <span className={reportsTo == null ? "text-muted-foreground" : ""}>
                  {reportsToLabel}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (top-level)</SelectItem>
                {sortedManagerGroups.length > 0 && <SelectSeparator />}
                {sortedManagerGroups.map(({ groupName, people }) => (
                  <SelectGroup key={groupName}>
                    <SelectLabel>{groupName}</SelectLabel>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">{p.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {p.title}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Leave this as <span className="font-medium">None</span> if this person should appear at the top level.
            </p>
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
