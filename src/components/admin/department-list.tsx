"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Plus } from "lucide-react";
import { DepartmentForm } from "./department-form";
import type { Department } from "@/types";

export function DepartmentList() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDepartments = useCallback(async () => {
    const res = await fetch("/api/departments");
    setDepartments(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/departments")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setDepartments(data);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  async function handleDelete(id: number) {
    if (!confirm("Delete this department?")) return;
    const res = await fetch(`/api/departments/${id}`, { method: "DELETE" });
    if (!res.ok) { const err = await res.json(); alert(err.error); return; }
    fetchDepartments();
  }

  if (loading) return <p className="text-rs-neutral-400">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Departments</h2>
        <DepartmentForm onSave={fetchDepartments} trigger={<Button size="sm"><Plus className="w-4 h-4 mr-2" />Add Department</Button>} />
      </div>
      <div className="space-y-2">
        {departments.map((dept) => (
          <div key={dept.id} className="flex items-center justify-between p-3 bg-rs-neutral-900 rounded-lg border border-rs-neutral-800">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: dept.color || "#666" }} />
              <span className="font-medium">{dept.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <DepartmentForm department={dept} onSave={fetchDepartments} trigger={<Button variant="ghost" size="icon"><Pencil className="w-4 h-4" /></Button>} />
              <Button variant="ghost" size="icon" onClick={() => handleDelete(dept.id)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
            </div>
          </div>
        ))}
        {departments.length === 0 && <p className="text-rs-neutral-400 text-sm">No departments yet. Add one to get started.</p>}
      </div>
    </div>
  );
}
