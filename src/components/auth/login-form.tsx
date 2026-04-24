"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const result = await login(username, password);
    if (result) {
      const next = new URLSearchParams(window.location.search).get("next");
      const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/chart";
      router.replace(target);
    } else {
      setError("Invalid username or password");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
          required
          className="h-11 bg-muted/40 dark:!bg-black/20 border-t-border border-l-border border-b-background border-r-background dark:border-t-black/40 dark:border-l-black/40 dark:border-b-white/[0.06] dark:border-r-white/[0.06] shadow-[inset_0_2px_5px_rgba(0,0,0,0.07)] dark:shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)] focus-visible:bg-background dark:focus-visible:!bg-background/80 transition-all duration-200"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          required
          className="h-11 bg-muted/40 dark:!bg-black/20 border-t-border border-l-border border-b-background border-r-background dark:border-t-black/40 dark:border-l-black/40 dark:border-b-white/[0.06] dark:border-r-white/[0.06] shadow-[inset_0_2px_5px_rgba(0,0,0,0.07)] dark:shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)] focus-visible:bg-background dark:focus-visible:!bg-background/80 transition-all duration-200"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full h-11 cursor-pointer transition-all duration-200">
        Sign In
      </Button>
    </form>
  );
}
