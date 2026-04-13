"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CsvImport } from "./csv-import";

interface Props {
  onImportComplete?: () => void;
  trigger?: React.ReactNode;
}

export function ImportDialog({ onImportComplete, trigger }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="cursor-pointer transition-all duration-200">
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
        )}
      </DialogTrigger>
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
  );
}
