"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  RefreshCw,
  Upload,
  Trash2,
  Image,
  UserCircle,
  ImageOff,
  Camera,
  ChevronRight,
  UserPlus,
  Check,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PhotoEntry = {
  filename: string;
  url: string;
  usedBy: { id: number; name: string } | null;
};

type PersonWithoutPhoto = {
  id: number;
  name: string;
  title: string;
  departmentName: string | null;
};

// --- Skeleton loader for photo cards ---
function PhotoSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-square bg-muted animate-pulse" />
      <CardContent className="p-2 space-y-1.5">
        <div className="h-3 w-3/4 bg-muted animate-pulse rounded" />
        <div className="h-4 w-full bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

// --- Stats bar ---
function StatsBar({ photos, missingCount, onMissingClick }: { photos: PhotoEntry[]; missingCount: number; onMissingClick?: () => void }) {
  const usedCount = photos.filter((p) => p.usedBy).length;
  const unusedCount = photos.length - usedCount;
  const total = photos.length + missingCount;
  const coverage = total > 0 ? Math.round((usedCount / total) * 100) : 0;

  const stats = [
    { label: "Total Photos", value: photos.length, color: "text-foreground" },
    { label: "Assigned", value: usedCount, color: "text-rs-primary-400" },
    { label: "Unused", value: unusedCount, color: "text-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-0.5"
        >
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {stat.label}
          </p>
          <p className={`text-lg font-bold tabular-nums ${stat.color}`}>
            {stat.value}
          </p>
        </div>
      ))}
      {/* Missing — clickable */}
      <button
        type="button"
        onClick={onMissingClick}
        disabled={missingCount === 0}
        className={`rounded-lg border px-3 py-2.5 space-y-0.5 text-left transition-all duration-150 group ${
          missingCount > 0
            ? "border-rs-accent-500/30 bg-rs-accent-500/[0.03] hover:border-rs-accent-500/50 hover:bg-rs-accent-500/[0.07] hover:shadow-md cursor-pointer active:scale-[0.97]"
            : "border-border bg-card"
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Missing
          </p>
          {missingCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-rs-accent-500/60 group-hover:text-rs-accent-500 transition-colors duration-150">
              <span className="hidden sm:inline">View all</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          )}
        </div>
        <p className={`text-lg font-bold tabular-nums ${missingCount > 0 ? "text-rs-accent-500" : "text-muted-foreground"}`}>
          {missingCount}
        </p>
      </button>
      {/* Coverage bar */}
      <div className="col-span-2 sm:col-span-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] text-muted-foreground">Photo coverage</p>
          <p className="text-[11px] font-medium tabular-nums">{coverage}%</p>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-rs-primary-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${coverage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// --- Main page ---
export default function PhotosPage() {
  const { isEditor } = useAuth();
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PhotoEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadSkipped, setUploadSkipped] = useState<string[]>([]);
  const [pendingUpload, setPendingUpload] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [missingPhotos, setMissingPhotos] = useState<PersonWithoutPhoto[]>([]);
  const [assignPhoto, setAssignPhoto] = useState<PhotoEntry | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingAssigningId, setMissingAssigningId] = useState<number | null>(null);
  const [missingSearch, setMissingSearch] = useState("");
  const missingInputRef = useRef<HTMLInputElement>(null);
  const missingPersonRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  async function fetchPhotos() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/photos");
      if (!res.ok) throw new Error(`Failed to fetch photos (${res.status})`);
      setPhotos(await res.json());
      const peopleRes = await fetch("/api/people");
      if (peopleRes.ok) {
        const allPeople = await peopleRes.json();
        setMissingPhotos(
          allPeople.filter((p: { photoUrl: string | null }) => !p.photoUrl)
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPhotos();
  }, []);

  const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const ACCEPTED_EXT = /\.(jpg|jpeg|png|gif|webp)$/i;
  const MAX_FILES = 20;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per file

  function filterValidFiles(files: FileList | File[]): { valid: File[]; skipped: string[] } {
    const valid: File[] = [];
    const skipped: string[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXT.test(file.name)) {
        skipped.push(`${file.name} (unsupported format)`);
      } else if (file.size > MAX_FILE_SIZE) {
        skipped.push(`${file.name} (exceeds 5MB)`);
      } else {
        valid.push(file);
      }
    }
    if (valid.length > MAX_FILES) {
      const excess = valid.splice(MAX_FILES);
      for (const f of excess) {
        skipped.push(`${f.name} (max ${MAX_FILES} files per upload)`);
      }
    }
    return { valid, skipped };
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    const errors: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Upload failed" }));
          errors.push(`${files[i].name} — ${body.error}`);
          if (res.status === 429) break; // stop on rate limit
        }
        setUploadProgress({ done: i + 1, total: files.length });
      }
      if (errors.length > 0) {
        setUploadSkipped((prev) => [...prev, ...errors]);
      }
      await fetchPhotos();
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function stageFiles(files: FileList | File[]) {
    const { valid, skipped } = filterValidFiles(files);
    if (skipped.length > 0) setUploadSkipped(skipped);
    if (valid.length === 0) return;
    setPendingUpload(valid);
    setPendingPreviews(valid.map((f) => URL.createObjectURL(f)));
  }

  function cancelPendingUpload() {
    pendingPreviews.forEach(URL.revokeObjectURL);
    setPendingUpload([]);
    setPendingPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function confirmPendingUpload() {
    const files = pendingUpload;
    pendingPreviews.forEach(URL.revokeObjectURL);
    setPendingUpload([]);
    setPendingPreviews([]);
    await uploadFiles(files);
  }

  function removePendingFile(index: number) {
    URL.revokeObjectURL(pendingPreviews[index]);
    setPendingUpload((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    stageFiles(e.target.files);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    if (!isEditor) return;
    stageFiles(e.dataTransfer.files);
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    if (isEditor) setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/photos/${encodeURIComponent(deleteTarget.filename)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.filename !== deleteTarget.filename));
        setDeleteTarget(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleAssignToPersonFromGallery(personId: number) {
    if (!assignPhoto) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/people/${personId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: assignPhoto.url }),
      });
      if (res.ok) {
        setAssignPhoto(null);
        setAssignSearch("");
        await fetchPhotos();
      }
    } finally {
      setAssigning(false);
    }
  }

  const filteredMissing = assignSearch
    ? missingPhotos.filter(
        (p) =>
          p.name.toLowerCase().includes(assignSearch.toLowerCase()) ||
          p.title.toLowerCase().includes(assignSearch.toLowerCase()) ||
          (p.departmentName ?? "").toLowerCase().includes(assignSearch.toLowerCase())
      )
    : missingPhotos;

  // Missing photos: assign handler
  async function handleMissingAssign(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const personId = missingPersonRef.current;
    if (!file || !personId) return;
    setMissingAssigningId(personId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) return;
      const { url } = await uploadRes.json();
      const patchRes = await fetch(`/api/people/${personId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: url }),
      });
      if (patchRes.ok) await fetchPhotos();
    } finally {
      setMissingAssigningId(null);
      missingPersonRef.current = null;
      if (missingInputRef.current) missingInputRef.current.value = "";
    }
  }

  function triggerMissingAssign(personId: number) {
    missingPersonRef.current = personId;
    missingInputRef.current?.click();
  }

  const groupedMissing = useMemo(() => {
    const filtered = missingSearch
      ? missingPhotos.filter(
          (p) =>
            p.name.toLowerCase().includes(missingSearch.toLowerCase()) ||
            p.title.toLowerCase().includes(missingSearch.toLowerCase()) ||
            (p.departmentName ?? "").toLowerCase().includes(missingSearch.toLowerCase())
        )
      : missingPhotos;
    const map: Record<string, PersonWithoutPhoto[]> = {};
    for (const person of filtered) {
      const dept = person.departmentName ?? "Unassigned";
      if (!map[dept]) map[dept] = [];
      map[dept].push(person);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [missingPhotos, missingSearch]);

  const deleteDescription = deleteTarget?.usedBy
    ? `This photo is used by ${deleteTarget.usedBy.name}. Deleting it will remove their profile picture.`
    : `Delete "${deleteTarget?.filename}"? This cannot be undone.`;

  return (
    <div
      className="space-y-6 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragging && (
        <div className="absolute inset-0 z-50 rounded-xl border-2 border-dashed border-rs-primary-500 bg-rs-primary-500/10 backdrop-blur-sm flex flex-col items-center justify-center gap-3 pointer-events-none">
          <div className="w-14 h-14 rounded-2xl bg-rs-primary-500/15 flex items-center justify-center">
            <Upload className="w-7 h-7 text-rs-primary-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-rs-primary-500">Drop photos here</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, GIF, WebP</p>
          </div>
        </div>
      )}

      {/* Skipped files notice */}
      {uploadSkipped.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-rs-accent-500/30 bg-rs-accent-500/5 px-3 py-2.5">
          <ImageOff className="w-4 h-4 text-rs-accent-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">
              {uploadSkipped.length} {uploadSkipped.length === 1 ? "file" : "files"} skipped — unsupported format
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {uploadSkipped.join(", ")}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Supported: JPG, PNG, GIF, WebP
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px] cursor-pointer shrink-0"
            onClick={() => setUploadSkipped([])}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-xl font-bold"
            style={{ fontFamily: "Merriweather, serif" }}
          >
            Photos
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage uploaded profile photos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPhotos}
            disabled={loading}
            className="gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {isEditor && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp"
                multiple
                className="hidden"
                onChange={handleFileInput}
              />
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                {uploadProgress
                  ? `Uploading ${uploadProgress.done}/${uploadProgress.total}...`
                  : "Upload Photos"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats (shown when loaded) */}
      {!loading && !error && (
        <StatsBar photos={photos} missingCount={missingPhotos.length} onMissingClick={() => setMissingOpen(true)} />
      )}

      {/* Content area */}
      {error ? (
        <div className="py-12 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <ImageOff className="w-6 h-6 text-destructive" />
          </div>
          <p className="text-sm text-destructive font-medium">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPhotos}
            className="gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <PhotoSkeleton key={i} />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div
          className={`rounded-xl border-2 border-dashed py-16 flex flex-col items-center gap-4 text-muted-foreground shadow-[inset_0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.15)] transition-colors duration-200 ${
            isEditor ? "cursor-pointer hover:border-rs-primary-500/40 hover:bg-rs-primary-500/[0.02]" : ""
          } ${dragging ? "border-rs-primary-500 bg-rs-primary-500/[0.04]" : "border-border/60 bg-muted/20"}`}
          onClick={isEditor ? () => fileInputRef.current?.click() : undefined}
          role={isEditor ? "button" : undefined}
          tabIndex={isEditor ? 0 : undefined}
          onKeyDown={isEditor ? (e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); } : undefined}
        >
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Upload className="w-7 h-7 opacity-30" aria-hidden="true" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-foreground">No photos uploaded yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {isEditor
                ? "Drag and drop photos here, or click to browse. Supports JPG, PNG, GIF, and WebP."
                : "No profile photos have been uploaded yet."}
            </p>
          </div>
          {isEditor && (
            <Button
              size="sm"
              disabled={uploading}
              className="gap-2 cursor-pointer pointer-events-none"
              tabIndex={-1}
            >
              <Upload className="w-4 h-4" />
              Browse Files
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {photos.map((photo) => (
            <Card
              key={photo.filename}
              className="overflow-hidden group hover:shadow-md hover:border-border/80 transition-all duration-200"
            >
              <div className="aspect-square bg-muted relative overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.usedBy?.name ?? photo.filename}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
                />
                {isEditor && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center gap-1.5">
                    {!photo.usedBy && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-7 text-[11px] gap-1 cursor-pointer shadow-sm"
                        onClick={() => setAssignPhoto(photo)}
                      >
                        <UserPlus className="w-3 h-3" />
                        Assign
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-7 text-[11px] gap-1 cursor-pointer shadow-sm text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(photo)}
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
              <CardContent className="p-2.5 space-y-1.5">
                <p
                  className="text-[11px] text-muted-foreground truncate"
                  title={photo.filename}
                >
                  {photo.filename}
                </p>
                {photo.usedBy ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 bg-rs-primary-500/10 text-rs-primary-400 border-rs-primary-500/20 w-full truncate block text-center"
                  >
                    {photo.usedBy.name}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 text-muted-foreground/60 border-dashed w-full text-center"
                  >
                    Unused
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete photo?"
        description={deleteDescription}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />

      {/* Upload confirmation dialog */}
      <Dialog
        open={pendingUpload.length > 0}
        onOpenChange={(open) => {
          if (!open) cancelPendingUpload();
        }}
      >
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Upload {pendingUpload.length} {pendingUpload.length === 1 ? "Photo" : "Photos"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 min-h-0">
            {/* File grid preview */}
            <div className="overflow-y-auto max-h-[45vh] -mx-1 px-1">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {pendingUpload.map((file, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden border border-border bg-muted aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pendingPreviews[i]}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removePendingFile(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer hover:bg-black/80"
                      title="Remove"
                    >
                      <span className="text-xs leading-none">&times;</span>
                    </button>
                    {/* Filename */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4">
                      <p className="text-[9px] text-white truncate">{file.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* File info */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {pendingUpload.length} {pendingUpload.length === 1 ? "file" : "files"} ·{" "}
                {(pendingUpload.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB total
              </span>
              <span>JPG, PNG, GIF, WebP</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={cancelPendingUpload}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmPendingUpload}
                disabled={pendingUpload.length === 0}
                className="gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Upload {pendingUpload.length} {pendingUpload.length === 1 ? "Photo" : "Photos"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Missing photos dialog */}
      <Dialog
        open={missingOpen}
        onOpenChange={(open) => {
          if (!open) {
            setMissingOpen(false);
            setMissingSearch("");
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-rs-accent-500" />
              Missing Photos
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-rs-accent-500 border-rs-accent-500/30 ml-1">
                {missingPhotos.length}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Hidden file input for assigning */}
          <input
            ref={missingInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.gif,.webp"
            className="hidden"
            onChange={handleMissingAssign}
          />

          <div className="flex flex-col gap-3 min-h-0">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, title, or department..."
                value={missingSearch}
                onChange={(e) => setMissingSearch(e.target.value)}
                className="w-full h-9 pl-8 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-rs-primary-500/30 focus:border-rs-primary-500"
              />
            </div>

            {/* Grouped list */}
            <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-3 min-h-0 max-h-[50vh]">
              {groupedMissing.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {missingPhotos.length === 0
                    ? "All team members have photos!"
                    : "No matching team members found."}
                </div>
              ) : (
                groupedMissing.map(([dept, persons]) => (
                  <div key={dept} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-rs-accent-500/50" />
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {dept}
                      </p>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 h-3.5 text-muted-foreground border-border ml-auto"
                      >
                        {persons.length}
                      </Badge>
                    </div>
                    {persons.map((person) => {
                      const isAssigningThis = missingAssigningId === person.id;
                      return (
                        <button
                          key={person.id}
                          type="button"
                          disabled={isAssigningThis || !isEditor}
                          onClick={() => triggerMissingAssign(person.id)}
                          className={`flex items-center gap-2.5 rounded-lg border border-border/50 px-2.5 py-2 transition-all duration-150 group text-left w-full ${
                            isEditor
                              ? "cursor-pointer hover:border-rs-accent-500/40 hover:bg-rs-accent-500/[0.04] hover:shadow-sm active:scale-[0.99]"
                              : ""
                          } ${isAssigningThis ? "opacity-70 pointer-events-none" : ""}`}
                        >
                          <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 transition-colors duration-150 ${
                            isEditor ? "group-hover:bg-rs-accent-500/15" : ""
                          }`}>
                            {isAssigningThis ? (
                              <RefreshCw className="w-4 h-4 text-rs-accent-500 animate-spin" />
                            ) : (
                              <UserCircle className={`w-4.5 h-4.5 text-muted-foreground transition-colors duration-150 ${
                                isEditor ? "group-hover:text-rs-accent-500" : ""
                              }`} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate leading-tight">
                              {person.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate leading-tight">
                              {person.title}
                            </p>
                          </div>
                          {isEditor && (
                            <span className={`flex items-center gap-1 text-[10px] shrink-0 transition-colors duration-150 ${
                              isAssigningThis
                                ? "text-rs-accent-500"
                                : "text-muted-foreground/50 group-hover:text-rs-accent-500"
                            }`}>
                              {isAssigningThis ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="w-3 h-3" />
                                  Add Photo
                                </>
                              )}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {isEditor && missingPhotos.length > 0 && (
              <p className="text-[11px] text-muted-foreground/70">
                Click any person to upload and assign a photo directly.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign photo dialog */}
      <Dialog
        open={assignPhoto !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAssignPhoto(null);
            setAssignSearch("");
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign Photo</DialogTitle>
          </DialogHeader>
          {assignPhoto && (
            <div className="flex flex-col gap-4 min-h-0">
              {/* Preview */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={assignPhoto.url}
                    alt={assignPhoto.filename}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Select a team member</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {assignPhoto.filename}
                  </p>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name, title, or department..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-rs-primary-500/30 focus:border-rs-primary-500"
                />
              </div>

              {/* Person list */}
              <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-1 min-h-0 max-h-[40vh]">
                {filteredMissing.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {missingPhotos.length === 0
                      ? "All team members already have photos."
                      : "No matching team members found."}
                  </div>
                ) : (
                  filteredMissing.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      disabled={assigning}
                      onClick={() => handleAssignToPersonFromGallery(person.id)}
                      className="w-full flex items-center gap-2.5 rounded-lg border border-border/50 px-3 py-2.5 text-left hover:border-rs-primary-500/40 hover:bg-rs-primary-500/[0.04] transition-all duration-150 cursor-pointer group disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 group-hover:bg-rs-primary-500/10 transition-colors duration-150">
                        <UserCircle className="w-4.5 h-4.5 text-muted-foreground group-hover:text-rs-primary-500 transition-colors duration-150" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate leading-tight">
                          {person.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate leading-tight">
                          {person.title}{person.departmentName ? ` · ${person.departmentName}` : ""}
                        </p>
                      </div>
                      <Check className="w-4 h-4 text-rs-primary-500 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
