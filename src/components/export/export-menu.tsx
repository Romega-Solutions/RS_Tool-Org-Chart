"use client";

import { Download, FileSpreadsheet, Image as ImageIcon, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChartExport } from "./use-chart-export";

export function ExportMenu() {
  const { exporting, handleExcel, handleExportPng, handlePrint } = useChartExport();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label="Open export options"
            className="text-muted-foreground hover:text-foreground text-xs gap-1.5 cursor-pointer transition-all duration-200"
          />
        }
      >
        <Download className="w-3.5 h-3.5" />
        {exporting ? "Exporting..." : "Export"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem disabled={exporting} onClick={() => void handleExportPng()}>
          <ImageIcon className="w-3.5 h-3.5" />
          PNG Image
        </DropdownMenuItem>
        <DropdownMenuItem disabled={exporting} onClick={() => void handleExcel()}>
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Export Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handlePrint()}>
          <Printer className="w-3.5 h-3.5" />
          Open Print / PDF View
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
