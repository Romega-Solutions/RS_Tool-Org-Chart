"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  function handlePrint() {
    const printUrl = new URL("/chart/print", window.location.origin);
    const printWindow = window.open(printUrl.toString(), "_blank");

    if (!printWindow) {
      window.location.assign(printUrl.toString());
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handlePrint}
      className="text-muted-foreground hover:text-foreground text-xs gap-1.5 cursor-pointer transition-all duration-200"
    >
      <Printer className="w-3.5 h-3.5" />
      Print
    </Button>
  );
}
