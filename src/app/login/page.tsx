import NextImage from "next/image";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="mb-8 text-center">
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
        <p className="text-muted-foreground mt-1">
          Romega Solutions - Authorized Access Only
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
