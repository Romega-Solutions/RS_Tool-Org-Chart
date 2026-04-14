"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChartExport } from "./use-chart-export";

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const { exporting, handleExcel, handlePrint } = useChartExport();

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground text-xs gap-1.5 cursor-pointer transition-all duration-200"
      >
        <Download className="w-3.5 h-3.5" />
        {exporting ? "Exporting..." : "Export"}
      </Button>

      {open && (
        <div className="absolute right-0 top-full pt-1 z-50">
          <div className="min-w-[160px] rounded-lg border border-border bg-card shadow-xl py-1 animate-in fade-in zoom-in-95">
            <button
              onClick={async () => {
                setOpen(false);
                await handleExcel();
              }}
              disabled={exporting}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Excel
            </button>
            <button
              onClick={() => {
                setOpen(false);
                handlePrint();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
