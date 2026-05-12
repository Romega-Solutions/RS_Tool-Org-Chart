"use client";
import { assetPath } from "@/lib/paths";
import { useEffect, useState } from "react";
import NextImage from "next/image";
import { motion } from "framer-motion";
import { LoginForm } from "@/components/auth/login-form";
import { ChartBackgroundDecor } from "@/components/chart/chart-background-decor";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, LogOut, Shield } from "lucide-react";

function VisitorAccessSnackbar({
  canLogout,
  onUseVisitor,
  onLogout,
}: {
  canLogout: boolean;
  onUseVisitor: () => void;
  onLogout: () => Promise<void>;
}) {
  const [visible, setVisible] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 7000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <TooltipProvider delay={100}>
      <motion.div
        role="status"
        aria-label="View-only visitor access"
        aria-live="polite"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="fixed bottom-4 left-4 right-4 z-20 sm:left-auto sm:right-5 sm:bottom-5 sm:w-[22rem]"
      >
        <div className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-xl">
          <div className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-rs-primary-500/10 text-rs-primary-500 dark:text-rs-primary-300">
                <Shield className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">New to Romega?</p>
                <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                  Use view-only access for onboarding.
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Where do I get the password?"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <HelpCircle className="h-4 w-4" aria-hidden="true" />
                    </button>
                  }
                />
                <TooltipContent side="top" align="end">
                  Message the onboarding team if the password is not yet known.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="space-y-2">
              <Button type="button" size="lg" className="h-10 w-full cursor-pointer" onClick={onUseVisitor}>
                Use view-only access
              </Button>
              {canLogout ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-10 w-full cursor-pointer"
                  onClick={async () => {
                    setLoggingOut(true);
                    try {
                      await onLogout();
                    } finally {
                      setLoggingOut(false);
                    }
                  }}
                  disabled={loggingOut}
                >
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  {loggingOut ? "Signing out..." : "Log out"}
                </Button>
              ) : null}
            </div>
          </div>
          <motion.div
            className="h-1 origin-left bg-rs-primary-500 dark:bg-rs-primary-300"
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: 7, ease: "linear" }}
          />
        </div>
      </motion.div>
    </TooltipProvider>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { user, loading: authLoading, logout } = useAuth();

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-background">
      <ChartBackgroundDecor />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md px-4"
      >
        <div className="bg-card border border-border rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <NextImage
              src={assetPath("/assets/romega-logo.svg")}
              alt="Romega Solutions"
              width={280}
              height={78}
              className="mx-auto mb-4 dark:invert dark:brightness-[0.9] dark:saturate-[1.3]"
              priority
              style={{ width: "280px", height: "auto" }}
            />
            <h1
              className="text-2xl font-bold text-foreground"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              Org Chart Generator
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Internal org chart access for Romega Solutions staff.
            </p>
          </div>
          <LoginForm
            username={username}
            password={password}
            onUsernameChange={setUsername}
            onPasswordChange={setPassword}
          />
        </div>

        {/* Security notice footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Romega internal access portal.</span>
        </motion.div>
      </motion.div>
      <VisitorAccessSnackbar
        canLogout={!authLoading && user?.username === "visitor"}
        onUseVisitor={() => {
          setUsername("visitor");
          setPassword("");
        }}
        onLogout={async () => {
          await logout();
          setUsername("");
          setPassword("");
        }}
      />
    </div>
  );
}
