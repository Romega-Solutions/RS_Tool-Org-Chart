"use client";

import { useEffect, useRef } from "react";
import { Printer, X, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

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
  const { theme, toggle } = useTheme();

  useEffect(() => {
    if (!ready || hasAutoPrintedRef.current) return;
    hasAutoPrintedRef.current = true;

    const timeoutId = window.setTimeout(async () => {
      if ("fonts" in document) await document.fonts.ready;
      await waitForImages();
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [ready]);

  return (
    <div className="print-controls">
      <div>
        <p className="print-controls-title">Print-ready org chart</p>
        <p className="print-controls-subtitle">
          Review the layout, then choose Print when you are ready to print or save as PDF.
        </p>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button
          type="button"
          onClick={toggle}
          className="print-controls-btn print-controls-btn--ghost"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <Sun style={{ width: 16, height: 16 }} />
          ) : (
            <Moon style={{ width: 16, height: 16 }} />
          )}
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <button type="button" onClick={() => window.print()} className="print-controls-btn print-controls-btn--primary">
          <Printer style={{ width: 16, height: 16 }} />
          Print
        </button>
        <button type="button" onClick={() => window.close()} className="print-controls-btn print-controls-btn--ghost">
          <X style={{ width: 16, height: 16 }} />
          Close
        </button>
      </div>
    </div>
  );
}
