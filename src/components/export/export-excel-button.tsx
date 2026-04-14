"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportExcelButton() {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);

    try {
      // Fetch data
      const [peopleRes, deptsRes] = await Promise.all([
        fetch("/api/people?includeInactive=true"),
        fetch("/api/departments"),
      ]);
      const people = await peopleRes.json();
      const departments = await deptsRes.json();

      // Build department lookup
      const deptMap = new Map<number, string>();
      for (const d of departments) {
        deptMap.set(d.id, d.name);
      }

      // Build person name lookup for reportsTo
      const nameMap = new Map<number, string>();
      for (const p of people) {
        nameMap.set(p.id, p.name);
      }

      // Dynamic import to keep bundle small
      const XLSX = await import("xlsx");

      // --- People sheet ---
      const peopleRows = people.map((p: Record<string, unknown>) => ({
        Name: p.name,
        Title: p.title,
        Department: deptMap.get(p.departmentId as number) || "",
        "Reports To": p.reportsTo ? nameMap.get(p.reportsTo as number) || "" : "",
        Status: p.isActive ? "Active" : "Inactive",
        "Employment Type": p.employmentType || "",
      }));
      const peopleSheet = XLSX.utils.json_to_sheet(peopleRows);

      // Auto-size columns
      const colWidths = Object.keys(peopleRows[0] || {}).map((key) => {
        const maxLen = Math.max(
          key.length,
          ...peopleRows.map((r: Record<string, string>) => String(r[key] || "").length)
        );
        return { wch: Math.min(maxLen + 2, 40) };
      });
      peopleSheet["!cols"] = colWidths;

      // --- Departments sheet ---
      const deptRows = departments.map((d: Record<string, unknown>) => ({
        Name: d.name,
        Color: d.color || "",
        Headcount: people.filter(
          (p: Record<string, unknown>) => p.departmentId === d.id && p.isActive
        ).length,
      }));
      const deptSheet = XLSX.utils.json_to_sheet(deptRows);
      deptSheet["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }];

      // Build workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, peopleSheet, "People");
      XLSX.utils.book_append_sheet(wb, deptSheet, "Departments");

      // Download
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `org-chart-${date}.xlsx`);
    } catch (err) {
      console.error("Excel export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
      className="text-muted-foreground hover:text-foreground text-xs gap-1.5 cursor-pointer transition-all duration-200"
    >
      <FileSpreadsheet className="w-3.5 h-3.5" />
      {exporting ? "Exporting..." : "Excel"}
    </Button>
  );
}
