"use client";
import NextImage from "next/image";
import { motion } from "framer-motion";
import { LoginForm } from "@/components/auth/login-form";
import { Shield } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-amber-50 dark:from-background dark:via-background dark:to-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md px-4"
      >
        <div className="bg-card border border-border rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <NextImage
              src="/assets/romega-logo.svg"
              alt="Romega Solutions"
              width={180}
              height={48}
              className="mx-auto mb-4 dark:invert"
              priority
            />
            <h1
              className="text-2xl font-bold text-foreground"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              Org Chart Generator
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Romega Solutions - Authorized Access Only
            </p>
          </div>
          <LoginForm />
        </div>

        {/* Security notice footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Protected by Romega Solutions. Authorized personnel only.</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
