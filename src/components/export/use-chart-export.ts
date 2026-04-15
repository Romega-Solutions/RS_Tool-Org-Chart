"use client";

import { useCallback, useState } from "react";
import type { Department, Person } from "@/types";
import { useSettings } from "@/hooks/use-settings";

async function fetchJson<T>(input: RequestInfo | URL): Promise<T> {
  const response = await fetch(input);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export function useChartExport() {
  const [exporting, setExporting] = useState(false);
  const { settings } = useSettings();

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

  const handleExportPng = useCallback(async () => {
    if (exporting) return;
    setExporting(true);

    try {
      const { toPng } = await import("html-to-image");

      const rfElement = document.querySelector(".react-flow") as HTMLElement | null;
      if (!rfElement) throw new Error("React Flow element not found");

      const isDark = document.documentElement.classList.contains("dark");

      // Capture at 2x — keep current theme, filter out UI chrome
      const chartDataUrl = await toPng(rfElement, {
        pixelRatio: 2,
        filter: (node) => {
          if (node instanceof HTMLElement) {
            const cls = node.className || "";
            if (typeof cls === "string") {
              // Exclude minimap, controls, attribution, handles, selection box
              if (
                cls.includes("react-flow__minimap") ||
                cls.includes("react-flow__controls") ||
                cls.includes("react-flow__attribution") ||
                cls.includes("react-flow__handle") ||
                cls.includes("react-flow__selection") ||
                cls.includes("collapsible-minimap")
              ) return false;
            }
            // Exclude by data attribute (minimap toggle)
            if (node.dataset?.exportIgnore === "true") return false;
          }
          return true;
        },
      });

      const chartImg = await loadImage(chartDataUrl);

      // Branding from settings
      const chartTitle = settings?.chart_title || "Organization Chart";
      const orgName = settings?.org_name || "";
      const tagline = settings?.tagline || "";
      const colorPrimary = settings?.color_primary || "#005ce6";
      const logoUrl = settings?.logo_url || "/assets/romega-logo.svg";

      let logoImg: HTMLImageElement | null = null;
      try { logoImg = await loadImage(logoUrl); } catch { /* proceed without */ }

      // Theme-aware colors
      const bgColor = isDark ? "#0f172a" : "#ffffff";
      const headerBg = isDark ? "#1e293b" : "#f8fafc";
      const titleColor = isDark ? "#f1f5f9" : "#0f172a";
      const taglineColor = isDark ? "#94a3b8" : "#64748b";

      // Scale chart to fill output tightly
      const HEADER_H = 120;
      const FOOTER_H = 90;
      const PAD = 48;

      // Output width = chart width + small padding (no artificial minimum)
      const canvasW = chartImg.width + PAD * 2;
      const canvasH = HEADER_H + chartImg.height + FOOTER_H;

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get canvas context");

      // --- Background ---
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvasW, canvasH);

      // --- Header ---
      ctx.fillStyle = headerBg;
      ctx.fillRect(0, 0, canvasW, HEADER_H);
      ctx.fillStyle = colorPrimary;
      ctx.fillRect(0, HEADER_H - 3, canvasW, 3);

      // Logo (left)
      if (logoImg) {
        const logoH = 52;
        const logoW = (logoImg.width / logoImg.height) * logoH;
        ctx.drawImage(logoImg, PAD, (HEADER_H - logoH) / 2, logoW, logoH);
      }

      // Title (center)
      ctx.fillStyle = titleColor;
      ctx.font = "bold 36px 'Source Sans 3', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(chartTitle.toUpperCase(), canvasW / 2, HEADER_H / 2);

      // Org name (right)
      if (orgName) {
        ctx.fillStyle = colorPrimary;
        ctx.font = "24px 'Source Sans 3', sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(orgName, canvasW - PAD, HEADER_H / 2);
      }

      // --- Chart (flush, no extra padding — image already has its own bg) ---
      ctx.drawImage(chartImg, PAD, HEADER_H, chartImg.width, chartImg.height);

      // --- Footer ---
      const footerY = canvasH - FOOTER_H;
      ctx.fillStyle = headerBg;
      ctx.fillRect(0, footerY, canvasW, FOOTER_H);
      ctx.fillStyle = colorPrimary;
      ctx.fillRect(0, footerY, canvasW, 3);

      if (tagline) {
        ctx.fillStyle = taglineColor;
        ctx.font = "italic 22px 'Source Sans 3', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(tagline, canvasW / 2, footerY + FOOTER_H / 2);
      }

      // --- Download ---
      const date = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.download = `org-chart-${date}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("PNG export failed:", error);
    } finally {
      setExporting(false);
    }
  }, [exporting, settings]);

  return { exporting, handleExcel, handleExportPng, handlePrint };
}
