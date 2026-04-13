"use client";
import { X, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getDeptIcon } from "@/lib/dept-icons";
import type { TreeNode } from "@/types";

interface Props {
  person: TreeNode | null;
  onClose: () => void;
  onSelectPerson?: (person: TreeNode) => void;
}

export function PersonDetailPanel({ person, onClose, onSelectPerson }: Props) {
  return (
    <AnimatePresence>
      {person && (
        <motion.aside
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="absolute top-0 right-0 z-20 h-full w-80 bg-card border-l border-border shadow-2xl flex flex-col rounded-l-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">
              Person Details
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Avatar and name */}
            <div className="flex flex-col items-center text-center gap-3">
              <Avatar className="w-20 h-20" size="lg">
                {person.photoUrl && <AvatarImage src={person.photoUrl} />}
                <AvatarFallback className="bg-rs-primary-500/20 text-rs-primary-400 text-lg">
                  {person.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xl font-bold text-foreground">
                  {person.name}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{person.title}</p>
              </div>
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
                    backgroundColor: person.department.color
                      ? `${person.department.color}20`
                      : undefined,
                    color: person.department.color || undefined,
                    borderColor: person.department.color
                      ? `${person.department.color}40`
                      : undefined,
                  }}
                >
                  <DeptIcon className="w-3 h-3" />
                  {person.department.name}
                </Badge>
              </div>
              );
            })()}

            {/* Employment type */}
            {person.employmentType && <div className="border-t border-border" />}
            {person.employmentType && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Employment Type
                </p>
                <p className="text-sm text-foreground">
                  {person.employmentType}
                </p>
              </div>
            )}

            {/* Direct reports */}
            {person.children.length > 0 && <div className="border-t border-border" />}
            {person.children.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Direct Reports ({person.children.length})
                </p>
                <div className="space-y-2">
                  {person.children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => onSelectPerson?.(child)}
                      className="w-full flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-all duration-200 text-left"
                    >
                      <Avatar className="w-7 h-7" size="sm">
                        {child.photoUrl && (
                          <AvatarImage src={child.photoUrl} />
                        )}
                        <AvatarFallback className="bg-rs-primary-500/10 text-rs-primary-400 text-[10px]">
                          {child.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {child.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {child.title}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
