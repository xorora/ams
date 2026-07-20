"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompanyOption } from "@/lib/admin/selected-company";
import { setSelectedCompany } from "@/lib/admin/selected-company";

type CompanySwitcherProps = {
  companies: CompanyOption[];
  selectedCompanyId: string;
};

export function CompanySwitcher({ companies, selectedCompanyId }: CompanySwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const companyItems = useMemo(
    () => Object.fromEntries(companies.map((company) => [company.id, company.name])),
    [companies],
  );

  async function handleChange(companyId: string) {
    if (companyId === selectedCompanyId) {
      return;
    }

    const result = await setSelectedCompany(companyId);
    if (result.ok) {
      startTransition(() => router.refresh());
    }
  }

  return (
    <Select
      items={companyItems}
      value={selectedCompanyId}
      onValueChange={(value) => void handleChange(value as string)}
    >
      <SelectTrigger
        size="sm"
        className="w-full min-w-0 max-w-full sm:min-w-[140px]"
        aria-label="Select company"
        disabled={isPending}
      >
        <Building2 className="size-4 text-muted-foreground" />
        <SelectValue placeholder="Company" />
      </SelectTrigger>
      <SelectContent align="end">
        {companies.map((company) => (
          <SelectItem key={company.id} value={company.id}>
            {company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
