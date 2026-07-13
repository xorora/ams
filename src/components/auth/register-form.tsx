"use client";

import { useMemo, useState, useTransition } from "react";
import { SignOutButton } from "@/components/layout/sign-out-button";
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
import { registerEmployeeAction } from "@/lib/auth/register-actions";

type RegisterFormProps = {
  email: string;
  name: string | null | undefined;
  companies: CompanyOption[];
};

export function RegisterForm({ email, name, companies }: RegisterFormProps) {
  const [employeeCode, setEmployeeCode] = useState("");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const companyItems = useMemo(
    () => Object.fromEntries(companies.map((company) => [company.id, company.name])),
    [companies],
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await registerEmployeeAction({ employeeCode, companyId });
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      {name ? (
        <p className="text-muted-foreground text-sm">
          Signed in as <span className="font-medium text-foreground">{name}</span>
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-email">Google account</Label>
        <Input id="register-email" type="email" value={email} readOnly disabled />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-company">Company</Label>
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
          <SelectTrigger id="register-company" className="w-full">
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
        <Label htmlFor="register-employee-code">Employee number</Label>
        <Input
          id="register-employee-code"
          required
          autoComplete="off"
          placeholder="e.g. 042"
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
          disabled={isPending}
        />
        <p className="text-muted-foreground text-xs">
          Enter your badge or employee number (case doesn&apos;t matter). Your employee record must
          already exist — we only link this Google account to that record.
        </p>
      </div>
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending || companies.length === 0}>
        {isPending ? "Continuing…" : "Continue"}
      </Button>
      <div className="flex justify-center pt-2">
        <SignOutButton />
      </div>
    </form>
  );
}
