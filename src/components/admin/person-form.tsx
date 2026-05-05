"use client";
import { apiPath, assetPath } from "@/lib/paths";
import { createElement, useState, useEffect, useRef } from "react";
import NextImage from "next/image";
import { toast } from "sonner";
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
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function getInitials(value: string) {
  return value
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function PersonForm({ person, onSave, trigger, open: controlledOpen, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [reportsTo, setReportsTo] = useState<number | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

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
      setSaveError(null);
      setLoadError(false);

      Promise.all([
        fetch(apiPath("/api/departments")).then((r) => r.json()),
        fetch(apiPath("/api/people")).then((r) => r.json()),
      ])
        .then(([depts, persons]) => {
          setDepartments(depts);
          setAllPeople(persons);
        })
        .catch(() => setLoadError(true));
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
      const res = await fetch(apiPath("/api/upload"), { method: "POST", body: formData });
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
    if (departmentId === null) {
      setSaveError("Department is required.");
      return;
    }
    setSaveError(null);
    setSaving(true);

    const url = person ? `/api/people/${person.id}` : "/api/people";
    const method = person ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
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

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaveError(body.error || `Failed to save (${res.status}). Please try again.`);
        return;
      }
    } catch {
      setSaveError("Network error. Please check your connection and try again.");
      return;
    } finally {
      setSaving(false);
    }

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
    toast.success(person ? `${name} updated` : `${name} added`);
  }

  const reportsToMatch = reportsTo ? allPeople.find((p) => p.id === reportsTo) : null;
  const reportsToLabel = reportsToMatch?.name ?? (reportsTo ? "Select manager" : "None (top-level)");
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
      groupColor: peopleInGroup[0]?.departmentColor || null,
      people: peopleInGroup.sort((a, b) => a.name.localeCompare(b.name)),
    }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger as React.ReactElement}>{}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{person ? "Edit Person" : "Add Person"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {loadError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              Failed to load form data. Please close and try again.
            </p>
          )}
          {/* Photo */}
          <div className="space-y-2">
            <Label>Photo</Label>
            <div className="flex items-center gap-3">
              {photoPreview ? (
                <NextImage
                  src={assetPath(photoPreview)}
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
              <Input
                placeholder="or paste image / Google Drive URL"
                className="text-xs h-8"
                value={photoUrl?.startsWith("/uploads/") ? "" : photoUrl ?? ""}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (!val) { setPhotoUrl(null); setPhotoPreview(null); return; }
                  // Convert Google Drive share links to direct image URLs
                  const driveMatch = val.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
                  const openMatch = val.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
                  const fileId = driveMatch?.[1] ?? openMatch?.[1];
                  const url = fileId ? `https://drive.google.com/uc?export=view&id=${fileId}` : val;
                  setPhotoUrl(url);
                  setPhotoPreview(url);
                }}
              />
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
              onValueChange={(val) => setDepartmentId(val === "" ? null : Number(val))}
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
                {person && (
                  <SelectItem value="">
                    <span className="text-muted-foreground">None (unassigned)</span>
                  </SelectItem>
                )}
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
                <span className={`inline-flex items-center gap-1.5 ${reportsTo == null ? "text-muted-foreground" : ""}`}>
                  {reportsToMatch?.departmentName && (
                    <span className="shrink-0" style={{ color: reportsToMatch.departmentColor || undefined }}>
                      {createElement(getDeptIcon(reportsToMatch.departmentName), { className: "size-3.5" })}
                    </span>
                  )}
                  <span className="truncate">{reportsToLabel}</span>
                  {reportsToMatch?.departmentName && (
                    <span className="text-xs text-muted-foreground">· {reportsToMatch.departmentName}</span>
                  )}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (top-level)</SelectItem>
                {sortedManagerGroups.length > 0 && <SelectSeparator />}
                {sortedManagerGroups.map(({ groupName, groupColor, people }) => (
                  <SelectGroup key={groupName}>
                    <SelectLabel>
                      <span className="inline-flex items-center gap-1.5" style={{ color: groupColor || undefined }}>
                        {createElement(getDeptIcon(groupName), { className: "size-3" })}
                        {groupName}
                      </span>
                    </SelectLabel>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="mt-0.5 shrink-0" style={{ color: p.departmentColor || undefined }}>
                            {createElement(getDeptIcon(p.departmentName || "Other"), { className: "size-3.5" })}
                          </span>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate">{p.name}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {p.title}
                            </span>
                          </div>
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
          {saveError && (
            <p className="text-sm text-destructive text-center">{saveError}</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
