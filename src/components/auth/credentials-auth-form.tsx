"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompanyOption } from "@/lib/admin/selected-company";
import {
  checkAuthEmailAction,
  credentialsLinkAction,
  credentialsLoginAction,
} from "@/lib/auth/credentials-actions";

type Step = "email" | "password" | "link";

type CredentialsAuthFormProps = {
  callbackUrl?: string;
  companies: CompanyOption[];
};

export function CredentialsAuthForm({
  callbackUrl = "/dashboard",
  companies,
}: CredentialsAuthFormProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const companyItems = useMemo(
    () => Object.fromEntries(companies.map((company) => [company.id, company.name])),
    [companies],
  );

  function resetToEmail() {
    setStep("email");
    setPassword("");
    setConfirmPassword("");
    setEmployeeCode("");
    setError(null);
  }

  function handleEmailContinue(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await checkAuthEmailAction(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setEmployeeCode("");
      setStep(result.data.next === "password" ? "password" : "link");
    });
  }

  function handlePasswordSignIn(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await credentialsLoginAction({
        email,
        password,
        callbackUrl,
      });
      if (result && !result.ok) {
        setError(result.error);
      }
    });
  }

  function handleLinkSignIn(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!companyId) {
      setError("Select your company.");
      return;
    }

    startTransition(async () => {
      const result = await credentialsLinkAction({
        email,
        password,
        employeeCode,
        companyId,
        callbackUrl,
      });
      if (result && !result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {step === "email" ? (
        <form onSubmit={handleEmailContinue} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
            />
          </div>
          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={isPending} className="h-10">
            {isPending ? "Checking…" : "Continue"}
          </Button>
        </form>
      ) : null}

      {step === "password" ? (
        <form onSubmit={handlePasswordSignIn} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="auth-email-readonly">Email</Label>
            <Input id="auth-email-readonly" type="email" value={email} readOnly disabled />
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
          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={isPending} className="h-10">
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={resetToEmail} disabled={isPending}>
            Use a different email
          </Button>
        </form>
      ) : null}

      {step === "link" ? (
        <form onSubmit={handleLinkSignIn} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="auth-email-link">Email</Label>
            <Input id="auth-email-link" type="email" value={email} readOnly disabled />
            <p className="text-muted-foreground text-xs">
              Link this email to your existing employee record. Your administrator must have created
              your employee profile first.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="auth-company">Company</Label>
            <Select
              items={companyItems}
              value={companyId}
              onValueChange={(value) => {
                if (value) {
                  setCompanyId(value);
                }
              }}
              disabled={isPending || companies.length === 0}
              required
            >
              <SelectTrigger id="auth-company" className="w-full">
                <SelectValue placeholder="Select your company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            <Label htmlFor="auth-new-password">Create password</Label>
            <Input
              id="auth-new-password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="auth-confirm-password">Confirm password</Label>
            <Input
              id="auth-confirm-password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isPending}
            />
          </div>
          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={isPending || companies.length === 0} className="h-10">
            {isPending ? "Linking…" : "Link & sign in"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={resetToEmail} disabled={isPending}>
            Use a different email
          </Button>
        </form>
      ) : null}
    </div>
  );
}
