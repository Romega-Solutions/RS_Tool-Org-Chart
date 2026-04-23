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
  ChevronDown,
  ChevronRight,
  ImageOff,
  Camera,
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
function StatsBar({ photos, missingCount }: { photos: PhotoEntry[]; missingCount: number }) {
  const usedCount = photos.filter((p) => p.usedBy).length;
  const unusedCount = photos.length - usedCount;
  const total = photos.length + missingCount;
  const coverage = total > 0 ? Math.round((usedCount / total) * 100) : 0;

  const stats = [
    { label: "Total Photos", value: photos.length, color: "text-foreground" },
    { label: "Assigned", value: usedCount, color: "text-rs-primary-400" },
    { label: "Unused", value: unusedCount, color: "text-muted-foreground" },
    { label: "Missing", value: missingCount, color: "text-rs-accent-500" },
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

// --- Missing photos recommendation panel ---
function MissingPhotosPanel({
  people,
  isEditor,
  onPhotoAssigned,
}: {
  people: PersonWithoutPhoto[];
  isEditor: boolean;
  onPhotoAssigned: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const assignInputRef = useRef<HTMLInputElement>(null);
  const pendingPersonRef = useRef<number | null>(null);

  async function handleAssignPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const personId = pendingPersonRef.current;
    if (!file || !personId) return;

    setAssigningId(personId);
    try {
      // Upload the photo
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) return;
      const { url } = await uploadRes.json();

      // Assign to person
      const patchRes = await fetch(`/api/people/${personId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: url }),
      });
      if (patchRes.ok) onPhotoAssigned();
    } finally {
      setAssigningId(null);
      pendingPersonRef.current = null;
      if (assignInputRef.current) assignInputRef.current.value = "";
    }
  }

  function triggerAssign(personId: number) {
    pendingPersonRef.current = personId;
    assignInputRef.current?.click();
  }

  const grouped = useMemo(() => {
    const map: Record<string, PersonWithoutPhoto[]> = {};
    for (const person of people) {
      const dept = person.departmentName ?? "Unassigned";
      if (!map[dept]) map[dept] = [];
      map[dept].push(person);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [people]);

  const previewCount = 6;
  const flatList = grouped.flatMap(([, persons]) => persons);
  const showToggle = flatList.length > previewCount;

  return (
    <div className="rounded-xl border border-rs-accent-500/20 bg-gradient-to-b from-rs-accent-500/[0.06] to-transparent overflow-hidden">
      {/* Hidden file input for assigning photos */}
      <input
        ref={assignInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAssignPhoto}
      />
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-rs-accent-500/[0.04] transition-colors duration-200"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rs-accent-500/15 flex items-center justify-center">
            <Camera className="w-4 h-4 text-rs-accent-500" />
          </div>
          <div className="text-left">
            <h2 className="text-sm font-semibold">
              Missing Photos
            </h2>
            <p className="text-xs text-muted-foreground">
              {people.length} {people.length === 1 ? "team member needs" : "team members need"} a profile photo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!expanded && (
            <div className="hidden sm:flex -space-x-1.5">
              {flatList.slice(0, 3).map((person) => (
                <div
                  key={person.id}
                  className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center"
                  title={person.name}
                >
                  <span className="text-[9px] font-medium text-muted-foreground">
                    {person.name.charAt(0)}
                  </span>
                </div>
              ))}
              {flatList.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-rs-accent-500/15 border-2 border-card flex items-center justify-center">
                  <span className="text-[9px] font-medium text-rs-accent-500">
                    +{flatList.length - 3}
                  </span>
                </div>
              )}
            </div>
          )}
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {grouped.map(([dept, persons]) => (
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
                {persons
                  .slice(0, showToggle && !expanded ? previewCount : undefined)
                  .map((person) => {
                    const isAssigning = assigningId === person.id;
                    const Wrapper = isEditor ? "button" : "div";
                    return (
                    <Wrapper
                      key={person.id}
                      className={`flex items-center gap-2.5 rounded-lg bg-background/80 border border-border/50 px-2.5 py-2 transition-all duration-150 group text-left w-full ${
                        isEditor
                          ? "cursor-pointer hover:border-rs-accent-500/40 hover:bg-rs-accent-500/[0.04] hover:shadow-sm active:scale-[0.99]"
                          : ""
                      } ${isAssigning ? "opacity-70 pointer-events-none" : ""}`}
                      {...(isEditor && !isAssigning
                        ? { onClick: () => triggerAssign(person.id), type: "button" as const }
                        : {})}
                    >
                      <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 transition-colors duration-150 ${
                        isEditor ? "group-hover:bg-rs-accent-500/15" : ""
                      }`}>
                        {isAssigning ? (
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
                          isAssigning
                            ? "text-rs-accent-500"
                            : "text-muted-foreground/50 group-hover:text-rs-accent-500"
                        }`}>
                          {isAssigning ? (
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
                    </Wrapper>
                    );
                  })}
              </div>
            ))}
          </div>
          {isEditor && (
            <p className="text-[11px] text-muted-foreground/70 pt-1">
              Click any card to upload and assign a photo directly.
            </p>
          )}
        </div>
      )}
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
  const [missingPhotos, setMissingPhotos] = useState<PersonWithoutPhoto[]>([]);
  const [assignPhoto, setAssignPhoto] = useState<PhotoEntry | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) await fetchPhotos();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

  const deleteDescription = deleteTarget?.usedBy
    ? `This photo is used by ${deleteTarget.usedBy.name}. Deleting it will remove their profile picture.`
    : `Delete "${deleteTarget?.filename}"? This cannot be undone.`;

  return (
    <div className="space-y-6">
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
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                {uploading ? "Uploading..." : "Upload Photo"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats (shown when loaded) */}
      {!loading && !error && (
        <StatsBar photos={photos} missingCount={missingPhotos.length} />
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
        <div className="py-16 flex flex-col items-center gap-4 text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Image className="w-8 h-8 opacity-30" aria-hidden="true" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-foreground">No photos uploaded yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Upload team member photos to personalize the org chart with profile pictures.
            </p>
          </div>
          {isEditor && (
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Upload First Photo
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

      {/* Missing photos recommendation */}
      {!loading && !error && missingPhotos.length > 0 && (
        <MissingPhotosPanel people={missingPhotos} isEditor={isEditor} onPhotoAssigned={fetchPhotos} />
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
