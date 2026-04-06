import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-white">Romega Solutions</h1>
        <p className="text-neutral-400 mt-1">Org Chart Generator</p>
      </div>
      <LoginForm />
    </div>
  );
}
