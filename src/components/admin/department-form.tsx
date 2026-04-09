"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Department } from "@/types";

interface Props { department?: Department; onSave: () => void; trigger: React.ReactNode; }

export function DepartmentForm({ department, onSave, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(department?.name || "");
  const [color, setColor] = useState(department?.color || "#0070E0");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const url = department ? `/api/departments/${department.id}` : "/api/departments";
    const method = department ? "PATCH" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, color }) });
    setSaving(false);
    setOpen(false);
    if (!department) { setName(""); setColor("#0070E0"); }
    onSave();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{department ? "Edit Department" : "Add Department"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dept-name">Name</Label>
            <Input id="dept-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-color">Color</Label>
            <div className="flex gap-2 items-center">
              <input type="color" id="dept-color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
            </div>
          </div>
          <Button type="submit" disabled={saving} className="w-full">{saving ? "Saving..." : "Save"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
