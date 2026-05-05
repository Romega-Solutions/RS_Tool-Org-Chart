"use client";
import { apiPath } from "@/lib/paths";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Plus } from "lucide-react";
import { DepartmentForm } from "./department-form";
import { getDeptIcon } from "@/lib/dept-icons";
import type { Department } from "@/types";

export function DepartmentList() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDepartments = useCallback(async () => {
    const res = await fetch(apiPath("/api/departments"));
    setDepartments(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(apiPath("/api/departments"))
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
    const res = await fetch(apiPath(`/api/departments/${id}`), { method: "DELETE" });
    if (!res.ok) { const err = await res.json(); alert(err.error); return; }
    fetchDepartments();
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Departments</h2>
        <DepartmentForm onSave={fetchDepartments} trigger={<Button size="sm" className="cursor-pointer transition-all duration-200"><Plus className="w-4 h-4 mr-2" />Add Department</Button>} />
      </div>
      <div className="space-y-2">
        {departments.map((dept) => {
          const DeptIcon = getDeptIcon(dept.name);
          return (
          <div key={dept.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border hover:shadow-sm hover:border-primary/30 transition-all duration-200">
            <div className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${dept.color || "#666"}20` }}
              >
                <DeptIcon className="w-3.5 h-3.5" style={{ color: dept.color || "#666" }} />
              </div>
              <span className="font-medium">{dept.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <DepartmentForm department={dept} onSave={fetchDepartments} trigger={<Button variant="ghost" size="icon" className="cursor-pointer transition-all duration-200"><Pencil className="w-4 h-4" /></Button>} />
              <Button variant="ghost" size="icon" className="cursor-pointer hover:bg-destructive/10 transition-all duration-200" onClick={() => handleDelete(dept.id)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
            </div>
          </div>
          );
        })}
        {departments.length === 0 && <p className="text-muted-foreground text-sm">No departments yet. Add one to get started.</p>}
      </div>
    </div>
  );
}
