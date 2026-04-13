"use client";

import { useEffect, useRef } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  ready: boolean;
}

async function waitForImages() {
  const images = Array.from(document.images);

  await Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();

      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    })
  );
}

export function PrintPageControls({ ready }: Props) {
  const hasAutoPrintedRef = useRef(false);

  useEffect(() => {
    if (!ready || hasAutoPrintedRef.current) return;

    hasAutoPrintedRef.current = true;

    const timeoutId = window.setTimeout(async () => {
      if ("fonts" in document) {
        await document.fonts.ready;
      }

      await waitForImages();
      window.print();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [ready]);

  return (
    <div className="print-screen-controls sticky top-0 z-20 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
      <div>
        <p className="text-sm font-semibold text-slate-900">Print-ready org chart</p>
        <p className="text-xs text-slate-500">
          Use your browser&apos;s print dialog to print or save as PDF.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="gap-2"
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => window.close()}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>
    </div>
  );
}
