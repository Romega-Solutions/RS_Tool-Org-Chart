"use client";
import { Image, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onExportPng?: () => void;
  onExportPdf?: () => void;
}

export function ExportButtons({ onExportPng, onExportPdf }: Props) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={onExportPng}
        className="text-rs-neutral-300 hover:text-rs-neutral-100 text-xs gap-1.5"
      >
        <Image className="w-3.5 h-3.5" />
        PNG
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onExportPdf}
        className="text-rs-neutral-300 hover:text-rs-neutral-100 text-xs gap-1.5"
      >
        <FileText className="w-3.5 h-3.5" />
        PDF
      </Button>
    </div>
  );
}
