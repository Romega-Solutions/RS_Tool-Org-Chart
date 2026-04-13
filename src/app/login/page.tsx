import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground">Romega Solutions</h1>
        <p className="text-muted-foreground mt-1">Org Chart Generator</p>
      </div>
      <LoginForm />
    </div>
  );
}
