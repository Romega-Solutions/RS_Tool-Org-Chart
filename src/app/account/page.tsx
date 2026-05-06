"use client";
import { apiPath, routerPath } from "@/lib/paths";
import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft,
  KeyRound,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import Link from "next/link";

// --- Password strength calculator ---
type Strength = "weak" | "fair" | "good" | "strong";

function getPasswordStrength(pw: string): { strength: Strength; score: number; checks: { label: string; met: boolean }[] } {
  const checks = [
    { label: "At least 8 characters", met: pw.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(pw) },
    { label: "Lowercase letter", met: /[a-z]/.test(pw) },
    { label: "Number", met: /[0-9]/.test(pw) },
    { label: "Special character", met: /[^A-Za-z0-9]/.test(pw) },
  ];
  const score = checks.filter((c) => c.met).length;
  const strength: Strength =
    score <= 2 ? "weak" : score === 3 ? "fair" : score === 4 ? "good" : "strong";
  return { strength, score, checks };
}

const strengthConfig: Record<Strength, { color: string; bg: string; label: string; width: string }> = {
  weak: { color: "text-red-500", bg: "bg-red-500", label: "Weak", width: "w-1/5" },
  fair: { color: "text-orange-500", bg: "bg-orange-500", label: "Fair", width: "w-2/5" },
  good: { color: "text-yellow-500", bg: "bg-yellow-500", label: "Good", width: "w-3/5" },
  strong: { color: "text-green-500", bg: "bg-green-500", label: "Strong", width: "w-full" },
};

// --- Password input with show/hide ---
function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  helperSlot,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  error?: string | null;
  helperSlot?: React.ReactNode;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : helperSlot ? `${id}-helper` : undefined}
          className={`pr-10 h-11 transition-colors duration-150 ${
            error
              ? "border-destructive focus-visible:ring-destructive/30"
              : ""
          }`}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-md transition-colors duration-150"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive flex items-center gap-1" role="alert">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
      {!error && helperSlot && (
        <div id={`${id}-helper`}>{helperSlot}</div>
      )}
    </div>
  );
}

// --- Main page ---
export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({ confirm: false });
  const firstErrorRef = useRef<HTMLInputElement>(null);

  // Password strength
  const pwStrength = useMemo(
    () => (newPassword.length > 0 ? getPasswordStrength(newPassword) : null),
    [newPassword]
  );
  const cfg = pwStrength ? strengthConfig[pwStrength.strength] : null;

  // Inline validation
  const confirmError =
    touched.confirm && confirmPassword.length > 0 && newPassword !== confirmPassword
      ? "Passwords don't match"
      : null;

  // Auto-focus first error field on submit error
  useEffect(() => {
    if (error) firstErrorRef.current?.focus();
  }, [error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!user) {
    router.replace(routerPath("/login?next=/account"));
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      setTouched({ confirm: true });
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from current password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiPath("/api/auth/change-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to change password" }));
        setError(body.error);
        return;
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        logout();
        router.replace(routerPath("/login"));
      }, 3000);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Back link */}
        <Link
          href={user.role === "editor" ? "/admin" : "/chart"}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {user.role === "editor" ? "Admin" : "Chart"}
        </Link>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Header with accent bar */}
          <div className="h-1 bg-gradient-to-r from-rs-primary-500 to-rs-primary-400" />
          <div className="p-6 space-y-6">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rs-primary-500/10 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-rs-primary-500" />
              </div>
              <div>
                <h1
                  className="text-lg font-bold"
                  style={{ fontFamily: "Merriweather, serif" }}
                >
                  Change Password
                </h1>
                <p className="text-xs text-muted-foreground">
                  Signed in as{" "}
                  <span className="font-medium text-foreground">{user.name}</span>{" "}
                  <span className="text-muted-foreground/60">({user.role})</span>
                </p>
              </div>
            </div>

            {/* Success state */}
            {success && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-5 space-y-3 text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                    Password changed successfully
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Signing you out in a moment so you can log in with your new password...
                  </p>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full animate-[shrink_3s_linear_forwards]" />
                </div>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div
                className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-destructive font-medium">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-destructive/50 hover:text-destructive cursor-pointer p-0.5"
                  aria-label="Dismiss error"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Form */}
            {!success && (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Current password */}
                <PasswordField
                  id="currentPassword"
                  label="Current Password"
                  value={currentPassword}
                  onChange={(v) => { setCurrentPassword(v); setError(null); }}
                  autoComplete="current-password"
                />

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">New password</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* New password with strength meter */}
                <PasswordField
                  id="newPassword"
                  label="New Password"
                  value={newPassword}
                  onChange={(v) => { setNewPassword(v); setError(null); }}
                  autoComplete="new-password"
                  helperSlot={
                    pwStrength && cfg ? (
                      <div className="space-y-2 pt-1">
                        {/* Strength bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ease-out ${cfg.bg}`}
                              style={{ width: `${(pwStrength.score / 5) * 100}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                        {/* Requirement checklist */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                          {pwStrength.checks.map((check) => (
                            <div
                              key={check.label}
                              className={`flex items-center gap-1.5 text-[10px] transition-colors duration-150 ${
                                check.met
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-muted-foreground/50"
                              }`}
                            >
                              {check.met ? (
                                <Check className="w-3 h-3 shrink-0" />
                              ) : (
                                <div className="w-3 h-3 rounded-full border border-current shrink-0" />
                              )}
                              {check.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Use 8+ characters with uppercase, lowercase, numbers, and symbols.
                      </p>
                    )
                  }
                />

                {/* Confirm password with inline match check */}
                <PasswordField
                  id="confirmPassword"
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChange={(v) => {
                    setConfirmPassword(v);
                    if (!touched.confirm) setTouched({ confirm: true });
                    setError(null);
                  }}
                  autoComplete="new-password"
                  error={confirmError}
                  helperSlot={
                    touched.confirm && confirmPassword.length > 0 && !confirmError ? (
                      <p className="text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Passwords match
                      </p>
                    ) : null
                  }
                />

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={
                    submitting ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword ||
                    !!confirmError
                  }
                  className="w-full h-11 cursor-pointer gap-2 text-sm font-medium transition-all duration-200"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Changing Password...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Change Password
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-[11px] text-muted-foreground/50">
          You&apos;ll be signed out after changing your password.
        </p>
      </div>

      {/* Success bar animation keyframe */}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
