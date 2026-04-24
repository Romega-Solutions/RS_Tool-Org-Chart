"use client";
import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { X, UserRound, Briefcase, ChevronLeft, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PersonForm } from "@/components/admin/person-form";
import { getDeptIcon } from "@/lib/dept-icons";
import type { TreeNode } from "@/types";

interface Props {
  person: TreeNode | null;
  onClose: () => void;
  onSelectPerson?: (person: TreeNode) => void;
  tree?: TreeNode[];
  isEditor?: boolean;
  onPersonUpdated?: () => void;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getAccentColor(person: TreeNode) {
  return person.department?.color || "var(--color-rs-primary-400)";
}

function findManager(tree: TreeNode[], targetId: number): TreeNode | null {
  function walk(node: TreeNode): TreeNode | null {
    for (const child of node.children) {
      if (child.id === targetId) return node;
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }
  for (const root of tree) {
    if (root.id === targetId) return null;
    const found = walk(root);
    if (found) return found;
  }
  return null;
}

// UX §7: exit-faster-than-enter — exit ~70% of enter duration
const enterTransition = { type: "spring" as const, damping: 25, stiffness: 300 };

function MiniHierarchyCard({
  person: p,
  label,
  active = false,
  onClick,
}: {
  person: TreeNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const accentColor = getAccentColor(p);
  const content = (
    <div
      className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-150 ${
        active
          ? "border-rs-primary-300 bg-rs-primary-500/8 shadow-[0_14px_28px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.72)] dark:shadow-[0_14px_28px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "border-border bg-background/92 shadow-[0_10px_24px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] hover:border-rs-primary-200 hover:bg-muted/40 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.78)] dark:shadow-[0_12px_26px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.07)]"
      }`}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: accentColor,
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-xl bg-gradient-to-b from-white/65 via-white/20 to-transparent dark:from-white/[0.06] dark:via-transparent dark:to-transparent" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[11px] shadow-[inset_0_-10px_20px_rgba(15,23,42,0.03)] dark:shadow-[inset_0_-10px_20px_rgba(0,0,0,0.12)]" />
      <div className="relative mb-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            active
              ? "bg-rs-primary-500/12 text-rs-primary-600 dark:text-rs-primary-300"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <span
            className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          {label}
        </span>
      </div>
      <div className="relative flex items-center gap-2.5">
        <Avatar className="h-8 w-8 shrink-0" size="sm">
          {p.photoUrl && <AvatarImage src={p.photoUrl} />}
          <AvatarFallback className="bg-rs-primary-500/10 text-rs-primary-400 text-[10px]">
            {getInitials(p.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">{p.name}</p>
          <p className="truncate text-[10px] text-muted-foreground">{p.title}</p>
        </div>
      </div>
    </div>
  );

  if (!onClick || active) {
    return content;
  }

  return (
    <button type="button" onClick={onClick} className="w-full">
      {content}
    </button>
  );
}

export function PersonDetailPanel({ person, onClose, onSelectPerson, tree, isEditor, onPersonUpdated }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<TreeNode[]>([]);
  const handlePanelClose = useCallback(() => {
    setHistory([]);
    onClose();
  }, [onClose]);

  // UX §1: focus-states — focus the panel when it opens
  useEffect(() => {
    if (person) {
      requestAnimationFrame(() => panelRef.current?.focus());
    }
  }, [person]);

  // UX §1: escape-routes + keyboard-nav
  useEffect(() => {
    if (!person) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handlePanelClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [person, handlePanelClose]);

  const manager = useMemo(() => {
    if (!person || !tree) return null;
    return findManager(tree, person.id);
  }, [person, tree]);

  const hierarchyAccent = useMemo(
    () => (person ? getAccentColor(person) : null),
    [person]
  );

  // UX §9: back-behavior — navigate back through history
  const handleNavigate = useCallback(
    (target: TreeNode) => {
      if (person) setHistory((prev) => [...prev, person]);
      onSelectPerson?.(target);
    },
    [person, onSelectPerson]
  );

  const handleBack = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    onSelectPerson?.(prev);
  }, [history, onSelectPerson]);

  return (
    <AnimatePresence>
      {person && (
        <>
          {/* Backdrop — click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 z-[19]"
            onClick={handlePanelClose}
            aria-hidden="true"
          />

          <motion.aside
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-label={`Details for ${person.name}`}
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={enterTransition}
            // UX §3: reduced-motion
            style={{ willChange: "transform, opacity" }}
            className="absolute top-0 right-0 z-20 h-full w-80 bg-card border-l border-border shadow-lg flex flex-col rounded-l-xl outline-none motion-reduce:transition-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                {/* UX §9: back-behavior */}
                {history.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                    aria-label="Go back to previous person"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-all duration-150 -ml-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                )}
                <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">
                  Person Details
                </h3>
              </div>
              <div className="flex items-center gap-1">
                {isEditor && person && (
                  <PersonForm
                    person={{
                      id: person.id,
                      name: person.name,
                      title: person.title,
                      isActive: person.isActive,
                      departmentId: person.department?.id ?? 0,
                      reportsTo: person.reportsTo ?? null,
                      displayOrder: person.displayOrder ?? 0,
                      photoUrl: person.photoUrl,
                      createdAt: person.createdAt ?? "",
                      updatedAt: person.updatedAt ?? "",
                      employmentType: person.employmentType ?? null,
                      projectIds: person.projectIds ?? null,
                      departmentName: person.department?.name ?? null,
                      departmentColor: person.department?.color ?? null,
                    }}
                    onSave={() => onPersonUpdated?.()}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit person"
                        className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-all duration-150"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    }
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePanelClose}
                  aria-label="Close detail panel"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-all duration-150"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content — animate on person change for smooth transitions */}
            <AnimatePresence mode="wait">
              <motion.div
                key={person.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="flex-1 overflow-y-auto p-4 space-y-5 motion-reduce:transition-none"
              >
                {/* Avatar, name, title, status */}
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="relative">
                    <Avatar className="w-20 h-20" size="lg">
                      {person.photoUrl && <AvatarImage src={person.photoUrl} />}
                      <AvatarFallback className="bg-rs-primary-500/20 text-rs-primary-400 text-lg">
                        {getInitials(person.name)}
                      </AvatarFallback>
                    </Avatar>
                    {/* Status dot — UX §1: color-not-only (dot + text badge below) */}
                    <span
                      className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-card ${
                        person.isActive ? "bg-emerald-500" : "bg-muted-foreground"
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{person.name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{person.title}</p>
                  </div>
                  <Badge
                    variant={person.isActive ? "default" : "secondary"}
                    className={`text-[10px] ${
                      person.isActive
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {person.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="border-t border-border" />

                {/* Department */}
                {person.department && (() => {
                  const DeptIcon = getDeptIcon(person.department.name);
                  return (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                        Department
                      </p>
                      <Badge
                        className="text-xs gap-1"
                        style={{
                          backgroundColor: person.department.color ? `${person.department.color}20` : undefined,
                          color: person.department.color || undefined,
                          borderColor: person.department.color ? `${person.department.color}40` : undefined,
                        }}
                      >
                        <DeptIcon className="w-3 h-3" />
                        {person.department.name}
                      </Badge>
                    </div>
                  );
                })()}

                {/* Local hierarchy */}
                {(manager || person.children.length > 0) && (
                  <>
                    <div className="border-t border-border" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                        <UserRound className="w-3 h-3" />
                        Local Hierarchy
                      </p>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                        <div className="flex flex-col items-center">
                          {manager && (
                            <>
                              <div className="w-full max-w-[220px]">
                                <MiniHierarchyCard
                                  person={manager}
                                  label="Manager"
                                  onClick={() => handleNavigate(manager)}
                                />
                              </div>
                              <div
                                className="h-4 w-px bg-border"
                                style={
                                  hierarchyAccent
                                    ? { backgroundColor: hierarchyAccent, opacity: 0.35 }
                                    : undefined
                                }
                              />
                            </>
                          )}

                          <div className="w-full max-w-[220px]">
                            <MiniHierarchyCard
                              person={person}
                              label={manager ? "Current" : "Top Level"}
                              active
                            />
                          </div>

                          {person.children.length > 0 && (
                            <>
                              <div
                                className="h-4 w-px bg-border"
                                style={
                                  hierarchyAccent
                                    ? { backgroundColor: hierarchyAccent, opacity: 0.35 }
                                    : undefined
                                }
                              />
                              <div className="w-full max-w-[220px] pl-5">
                                <div className="relative space-y-2">
                                  <div
                                    className="absolute bottom-4 left-[7px] top-0 w-px bg-border"
                                    style={
                                      hierarchyAccent
                                        ? { backgroundColor: hierarchyAccent, opacity: 0.35 }
                                        : undefined
                                    }
                                  />
                                  {person.children.map((child) => (
                                    <div key={child.id} className="relative pl-4">
                                      <div
                                        className="absolute left-0 top-5 h-px w-4 bg-border"
                                        style={{
                                          backgroundColor: getAccentColor(child),
                                          opacity: 0.35,
                                        }}
                                      />
                                      <MiniHierarchyCard
                                        person={child}
                                        label="Direct Report"
                                        onClick={() => handleNavigate(child)}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Employment type */}
                {person.employmentType && (
                  <>
                    <div className="border-t border-border" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        Employment Type
                      </p>
                      <p className="text-sm text-foreground">{person.employmentType}</p>
                    </div>
                  </>
                )}

              </motion.div>
            </AnimatePresence>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
