"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { credentialsSignInAction } from "@/lib/auth/credentials-actions";

type CredentialsAuthFormProps = {
  callbackUrl?: string;
};

export function CredentialsAuthForm({ callbackUrl = "/dashboard" }: CredentialsAuthFormProps) {
  const [employeeCode, setEmployeeCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await credentialsSignInAction({
        employeeCode,
        email,
        password,
        name: name.trim() || undefined,
        callbackUrl,
      });

      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="auth-employee-code">Employee code</Label>
        <Input
          id="auth-employee-code"
          required
          autoComplete="username"
          placeholder="e.g. 042"
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
          disabled={isPending}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@gmail.com or you@xorora.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="auth-password">Password</Label>
        <Input
          id="auth-password"
          type="password"
          required
          autoComplete="current-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isPending}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="auth-name">Full name (optional)</Label>
        <Input
          id="auth-name"
          autoComplete="name"
          placeholder="Used when creating a new employee record"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
        />
        <p className="text-muted-foreground text-xs">
          Enter your employee or badge number. If HR already added you, we link your account and
          update your email. Otherwise we create a new employee record for that code.
        </p>
      </div>
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={isPending} className="h-10">
        {isPending ? "Signing in…" : "Continue"}
      </Button>
    </form>
  );
}
