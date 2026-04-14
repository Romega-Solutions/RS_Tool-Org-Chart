"use client";

import { useCallback, useState } from "react";
import type { Department, Person } from "@/types";

async function fetchJson<T>(input: RequestInfo | URL): Promise<T> {
  const response = await fetch(input);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function useChartExport() {
  const [exporting, setExporting] = useState(false);

  const handlePrint = useCallback(() => {
    const printUrl = new URL("/chart/print", window.location.origin);
    const printWindow = window.open(printUrl.toString(), "_blank");

    if (!printWindow) {
      window.location.assign(printUrl.toString());
    }
  }, []);

  const handleExcel = useCallback(async () => {
    if (exporting) return;
    setExporting(true);

    try {
      const [people, departments] = await Promise.all([
        fetchJson<Person[]>("/api/people?includeInactive=true"),
        fetchJson<Department[]>("/api/departments"),
      ]);

      const deptMap = new Map<number, string>();
      for (const department of departments) {
        deptMap.set(department.id, department.name);
      }

      const nameMap = new Map<number, string>();
      for (const person of people) {
        nameMap.set(person.id, person.name);
      }

      const XLSX = await import("xlsx");

      const peopleRows = people.map((person) => ({
        Name: person.name,
        Title: person.title,
        Department: deptMap.get(person.departmentId) || "",
        "Reports To": person.reportsTo ? nameMap.get(person.reportsTo) || "" : "",
        Status: person.isActive ? "Active" : "Inactive",
        "Employment Type": person.employmentType || "",
      }));
      const peopleSheet = XLSX.utils.json_to_sheet(peopleRows);
      const colWidths = Object.keys(peopleRows[0] || {}).map((key) => {
        const maxLen = Math.max(
          key.length,
          ...peopleRows.map((row) => String(row[key as keyof typeof row] || "").length)
        );
        return { wch: Math.min(maxLen + 2, 40) };
      });
      peopleSheet["!cols"] = colWidths;

      const deptRows = departments.map((department) => ({
        Name: department.name,
        Color: department.color || "",
        Headcount: people.filter(
          (person) => person.departmentId === department.id && person.isActive
        ).length,
      }));
      const deptSheet = XLSX.utils.json_to_sheet(deptRows);
      deptSheet["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, peopleSheet, "People");
      XLSX.utils.book_append_sheet(workbook, deptSheet, "Departments");

      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `org-chart-${date}.xlsx`);
    } catch (error) {
      console.error("Excel export failed:", error);
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  return { exporting, handleExcel, handlePrint };
}
