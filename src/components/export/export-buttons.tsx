"use client";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { FileImage, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportButtons() {
  async function exportPng() {
    const el = document.getElementById("chart-container");
    if (!el) return;
    const dataUrl = await toPng(el, {
      pixelRatio: 2,
      backgroundColor: "#0d1117",
    });
    const link = document.createElement("a");
    link.download = `org-chart-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
  }

  async function exportPdf() {
    const el = document.getElementById("chart-container");
    if (!el) return;
    const dataUrl = await toPng(el, {
      pixelRatio: 2,
      backgroundColor: "#0d1117",
    });
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => (img.onload = resolve));
    const pdf = new jsPDF({
      orientation: img.width > img.height ? "landscape" : "portrait",
      unit: "px",
      format: [img.width / 2, img.height / 2],
    });
    pdf.addImage(dataUrl, "PNG", 0, 0, img.width / 2, img.height / 2);
    pdf.save(`org-chart-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={exportPng}
        className="text-muted-foreground hover:text-foreground text-xs gap-1.5 cursor-pointer transition-all duration-200"
      >
        <FileImage className="w-3.5 h-3.5" />
        PNG
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={exportPdf}
        className="text-muted-foreground hover:text-foreground text-xs gap-1.5 cursor-pointer transition-all duration-200"
      >
        <FileText className="w-3.5 h-3.5" />
        PDF
      </Button>
    </div>
  );
}
