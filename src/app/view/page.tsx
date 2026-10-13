"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChartCanvas } from "@/components/chart/chart-canvas";
import { Button } from "@/components/ui/button";
import { routerPath } from "@/lib/paths";
import { LogIn } from "lucide-react";

function PublicLoginSnackbar() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 7000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <motion.div
      role="status"
      aria-label="Public view login prompt"
      aria-live="polite"
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="fixed bottom-4 left-4 right-4 z-30 sm:left-auto sm:right-5 sm:bottom-5 sm:w-80"
    >
      <div className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-xl">
        <div className="space-y-3 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Need full access?</p>
            <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
              Log in to use employee tools and account access.
            </p>
          </div>
          <Button type="button" size="lg" className="h-10 w-full cursor-pointer" onClick={() => router.push(routerPath("/login"))}>
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Log in
          </Button>
        </div>
        <motion.div
          className="h-1 origin-left bg-rs-primary-500 dark:bg-rs-primary-300"
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: 7, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

function ViewPageContent() {
  const searchParams = useSearchParams();
  const publicCode = searchParams.get("public")?.trim();
  const dataEndpoint = useMemo(
    () => publicCode ? `/api/public-chart-data?code=${encodeURIComponent(publicCode)}` : undefined,
    [publicCode],
  );

  return (
    <div className="h-screen w-full">
      <ChartCanvas dataEndpoint={dataEndpoint} showExport={!publicCode} />
      {publicCode && <PublicLoginSnackbar />}
    </div>
  );
}

export default function ViewPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-background" />}>
      <ViewPageContent />
    </Suspense>
  );
}
