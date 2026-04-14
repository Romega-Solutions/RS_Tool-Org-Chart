"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChartExport } from "./use-chart-export";

interface Props {
  collapsed: boolean;
}

export function ExportQuickAction({ collapsed }: Props) {
  const [open, setOpen] = useState(false);
  const { exporting, handleExcel, handlePrint } = useChartExport();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size={collapsed ? "icon" : "sm"}
        className={`${
          collapsed ? "w-full justify-center" : "w-full justify-start"
        } text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-all duration-200`}
        onClick={() => setOpen(true)}
        title={collapsed ? "Export Chart" : undefined}
      >
        <FileDown className="w-4 h-4 shrink-0" />
        {!collapsed && <span className="ml-2">Export Chart</span>}
      </Button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export chart</DialogTitle>
          <DialogDescription>
            Choose whether to export the org data as Excel or open the print/PDF view.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Button
            variant="outline"
            className="justify-start"
            disabled={exporting}
            onClick={async () => {
              await handleExcel();
              setOpen(false);
            }}
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting ? "Exporting Excel..." : "Export Excel"}
          </Button>

          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              setOpen(false);
              handlePrint();
            }}
          >
            <Printer className="w-4 h-4" />
            Open Print / PDF View
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
