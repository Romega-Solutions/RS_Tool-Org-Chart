"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CsvImport } from "./csv-import";

interface Props {
  onImportComplete?: () => void;
}

export function ImportDialog({ onImportComplete }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="cursor-pointer transition-all duration-200"
        onClick={() => setOpen(true)}
      >
        <Upload className="w-4 h-4 mr-2" />
        Import CSV
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import People from CSV</DialogTitle>
          </DialogHeader>
          <CsvImport
            compact
            onComplete={() => {
              onImportComplete?.();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
