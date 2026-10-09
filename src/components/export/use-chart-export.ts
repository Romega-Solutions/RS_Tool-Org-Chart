"use client";
import { apiPath, appPath, assetPath } from "@/lib/paths";

import { useCallback, useState } from "react";
import type { ChartData, TreeNode } from "@/types";
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
    const printUrl = new URL(appPath("/chart/print"), window.location.origin);
    const printWindow = window.open(printUrl.toString(), "_blank");

    if (!printWindow) {
      window.location.assign(printUrl.toString());
    }
  }, []);

  const handleExcel = useCallback(async () => {
    if (exporting) return;
    setExporting(true);

    try {
      const { tree, departments } = await fetchJson<ChartData>(apiPath("/api/chart-data"));
      const people: TreeNode[] = [];
      const collect = (nodes: TreeNode[]) => {
        for (const node of nodes) {
          people.push(node);
          collect(node.children);
        }
      };
      collect(tree);

      const deptMap = new Map<number, string>();
      const deptColorMap = new Map<number, string>();
      for (const department of departments) {
        deptMap.set(department.id, department.name);
        if (department.color) deptColorMap.set(department.id, department.color);
      }

      const nameMap = new Map<number, string>();
      for (const person of people) {
        nameMap.set(person.id, person.name);
      }

      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = settings?.org_name || "Org Chart Generator";
      workbook.created = new Date();

      // --- Shared styles ---
      const headerFill = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FF0070E0" }, // RS primary blue
      };
      const headerFont = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 11,
      };
      const borderStyle = {
        top: { style: "thin" as const, color: { argb: "FFD0D5DD" } },
        bottom: { style: "thin" as const, color: { argb: "FFD0D5DD" } },
        left: { style: "thin" as const, color: { argb: "FFD0D5DD" } },
        right: { style: "thin" as const, color: { argb: "FFD0D5DD" } },
      };
      const altRowFill = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FFF8FAFC" },
      };

      // --- People sheet ---
      const peopleSheet = workbook.addWorksheet("People", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      const peopleCols = [
        { header: "Name", key: "name", width: 24 },
        { header: "Title", key: "title", width: 28 },
        { header: "Department", key: "department", width: 22 },
        { header: "Reports To", key: "reportsTo", width: 22 },
      ];
      peopleSheet.columns = peopleCols;

      // Header row styling
      const peopleHeaderRow = peopleSheet.getRow(1);
      peopleHeaderRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = borderStyle;
      });
      peopleHeaderRow.height = 28;

      // Data rows
      for (let i = 0; i < people.length; i++) {
        const person = people[i];
        const row = peopleSheet.addRow({
          name: person.name,
          title: person.title,
          department: deptMap.get(person.departmentId) || "",
          reportsTo: person.reportsTo ? nameMap.get(person.reportsTo) || "" : "",
        });

        row.eachCell((cell) => {
          cell.border = borderStyle;
          cell.alignment = { vertical: "middle" };
        });

        // Alternating row fill
        if (i % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = altRowFill;
          });
        }

      }

      // Auto-filter
      peopleSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: people.length + 1, column: peopleCols.length },
      };

      // --- Departments sheet ---
      const deptSheet = workbook.addWorksheet("Departments", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      const deptCols = [
        { header: "Department", key: "name", width: 28 },
        { header: "Color", key: "color", width: 14 },
        { header: "Headcount", key: "headcount", width: 14 },
      ];
      deptSheet.columns = deptCols;

      // Header row styling
      const deptHeaderRow = deptSheet.getRow(1);
      deptHeaderRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = borderStyle;
      });
      deptHeaderRow.height = 28;

      // Data rows
      for (let i = 0; i < departments.length; i++) {
        const dept = departments[i];
        const headcount = people.filter(
          (p) => p.departmentId === dept.id
        ).length;

        const row = deptSheet.addRow({
          name: dept.name,
          color: dept.color || "",
          headcount,
        });

        row.eachCell((cell) => {
          cell.border = borderStyle;
          cell.alignment = { vertical: "middle" };
        });

        if (i % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = altRowFill;
          });
        }

        // Color swatch — fill the color cell with the department color
        if (dept.color) {
          const colorCell = row.getCell("color");
          const hex = dept.color.replace("#", "");
          colorCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: `FF${hex}` },
          };
          // Determine text contrast
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          colorCell.font = {
            color: { argb: luminance > 0.5 ? "FF000000" : "FFFFFFFF" },
          };
        }
      }

      // Auto-filter
      deptSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: departments.length + 1, column: deptCols.length },
      };

      // --- Download ---
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const date = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.download = `org-chart-${date}.xlsx`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Excel export failed:", error);
    } finally {
      setExporting(false);
    }
  }, [exporting, settings]);

  const handleExportPng = useCallback(async () => {
    if (exporting) return;
    setExporting(true);

    try {
      const { toPng } = await import("html-to-image");

      const rfElement = document.querySelector(".react-flow") as HTMLElement | null;
      if (!rfElement) throw new Error("React Flow element not found");

      const isDark = document.documentElement.classList.contains("dark");

      // Fit the chart to view before capture so it's not zoomed out.
      // Find the React Flow viewport and compute the tight bounds of all nodes.
      const viewport = rfElement.querySelector(".react-flow__viewport") as HTMLElement | null;
      const savedTransform = viewport?.style.transform || "";
      const nodeEls = rfElement.querySelectorAll<HTMLElement>(".react-flow__node");
      if (viewport && nodeEls.length > 0) {
        // Compute bounding box of all nodes in flow coordinates
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const node of nodeEls) {
          // Use transform for position (React Flow uses CSS transform)
          const transform = node.style.transform;
          const match = transform?.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
          const tx = match ? parseFloat(match[1]) : 0;
          const ty = match ? parseFloat(match[2]) : 0;
          const nx = tx;
          const ny = ty;
          const nw = node.offsetWidth;
          const nh = node.offsetHeight;
          if (nx < minX) minX = nx;
          if (ny < minY) minY = ny;
          if (nx + nw > maxX) maxX = nx + nw;
          if (ny + nh > maxY) maxY = ny + nh;
        }

        const padding = 40;
        const boundsW = maxX - minX + padding * 2;
        const boundsH = maxY - minY + padding * 2;
        const containerW = rfElement.offsetWidth;
        const containerH = rfElement.offsetHeight;
        const scale = Math.min(containerW / boundsW, containerH / boundsH, 1.5);
        const translateX = (containerW - boundsW * scale) / 2 - (minX - padding) * scale;
        const translateY = (containerH - boundsH * scale) / 2 - (minY - padding) * scale;
        viewport.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        // Allow a frame for the transform to apply
        await new Promise((r) => setTimeout(r, 100));
      }

      // Resolve CSS variables to inline styles for SVG edges before capture.
      // html-to-image can't resolve CSS custom properties inside SVGs.
      const edgePaths = rfElement.querySelectorAll<SVGElement>(".react-flow__edge path, .react-flow__edge line, .react-flow__edge polyline");
      const originalStyles: { el: SVGElement; stroke: string; strokeWidth: string; opacity: string }[] = [];

      const computedEdgeStroke = getComputedStyle(document.documentElement).getPropertyValue("--chart-edge-stroke").trim();

      for (const el of edgePaths) {
        const computed = getComputedStyle(el);
        originalStyles.push({
          el,
          stroke: el.style.stroke,
          strokeWidth: el.style.strokeWidth,
          opacity: el.style.opacity,
        });
        // Inline the resolved values
        el.style.stroke = computed.stroke || computedEdgeStroke || (isDark ? "rgba(148,163,184,0.26)" : "rgba(58,116,179,0.34)");
        el.style.strokeWidth = computed.strokeWidth || "1.5";
        if (!el.style.opacity) el.style.opacity = computed.opacity || "0.9";
      }

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

      // Restore original styles
      for (const { el, stroke, strokeWidth, opacity } of originalStyles) {
        el.style.stroke = stroke;
        el.style.strokeWidth = strokeWidth;
        el.style.opacity = opacity;
      }

      // Restore viewport transform
      if (viewport) {
        viewport.style.transform = savedTransform;
      }

      const chartImg = await loadImage(chartDataUrl);

      // Branding from settings
      const chartTitle = settings?.chart_title || "Organization Chart";
      const tagline = settings?.tagline || "";
      const colorPrimary = settings?.color_primary || "#005ce6";
      const logoUrl = assetPath(settings?.logo_url || "/assets/romega-logo.svg");

      let logoImg: HTMLImageElement | null = null;
      try { logoImg = await loadImage(logoUrl); } catch { /* proceed without */ }

      // Theme-aware colors
      const bgColor = isDark ? "#0f172a" : "#ffffff";
      const headerBg = isDark ? "#1e293b" : "#f8fafc";
      const titleColor = isDark ? "#f1f5f9" : "#0f172a";
      const taglineColor = isDark ? "#94a3b8" : "#64748b";

      // All sizes scaled to 2x to match the chart's pixelRatio: 2
      const S = 2; // scale factor matching pixelRatio
      const HEADER_H = 120 * S;
      const FOOTER_H = 90 * S;
      const PAD = 48 * S;

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
      ctx.fillRect(0, HEADER_H - 3 * S, canvasW, 3 * S);

      // Logo (left) — larger to fill header, invert for dark mode
      if (logoImg) {
        const logoH = 72 * S;
        const logoW = (logoImg.width / logoImg.height) * logoH;
        if (isDark) {
          ctx.save();
          ctx.filter = "invert(1) brightness(0.9) saturate(1.3)";
          ctx.drawImage(logoImg, PAD, (HEADER_H - logoH) / 2, logoW, logoH);
          ctx.restore();
        } else {
          ctx.drawImage(logoImg, PAD, (HEADER_H - logoH) / 2, logoW, logoH);
        }
      }

      // Title (center)
      ctx.fillStyle = titleColor;
      ctx.font = `bold ${36 * S}px 'Source Sans 3', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(chartTitle.toUpperCase(), canvasW / 2, HEADER_H / 2);

      // Date (right)
      const exportDate = new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      ctx.fillStyle = taglineColor;
      ctx.font = `${18 * S}px 'Source Sans 3', sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(exportDate, canvasW - PAD, HEADER_H / 2);

      // --- Chart area: dotted background pattern ---
      const chartAreaY = HEADER_H;
      const chartAreaH = chartImg.height;

      // Draw dot grid pattern (matching ChartBackgroundDecor at 22px spacing, scaled to 2x)
      const dotSpacing = 22 * S;
      const dotColor = isDark ? "rgba(148,163,184,0.12)" : "rgba(57,103,151,0.1)";
      ctx.fillStyle = dotColor;
      for (let dx = 0; dx < canvasW; dx += dotSpacing) {
        for (let dy = 0; dy < chartAreaH; dy += dotSpacing) {
          ctx.beginPath();
          ctx.arc(dx, chartAreaY + dy, 1.5 * S, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- Chart image on top of dotted bg ---
      ctx.drawImage(chartImg, PAD, HEADER_H, chartImg.width, chartImg.height);

      // --- Footer ---
      const footerY = canvasH - FOOTER_H;
      ctx.fillStyle = headerBg;
      ctx.fillRect(0, footerY, canvasW, FOOTER_H);
      ctx.fillStyle = colorPrimary;
      ctx.fillRect(0, footerY, canvasW, 3 * S);

      if (tagline) {
        ctx.fillStyle = taglineColor;
        ctx.font = `italic ${22 * S}px 'Source Sans 3', sans-serif`;
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
