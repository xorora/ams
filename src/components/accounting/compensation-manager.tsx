"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CompensationTable } from "@/components/accounting/compensation-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compensationListQuery } from "@/lib/accounting/query-params";
import type { SerializedCompensationListItem } from "@/lib/accounting/types";

type CompensationManagerProps = {
  items: SerializedCompensationListItem[];
  search: string;
};

export function CompensationManager({ items, search }: CompensationManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const href = `/admin/accounting/compensation${compensationListQuery({ search: searchInput })}`;
    const currentHref = `/admin/accounting/compensation${compensationListQuery({ search })}`;
    if (href === currentHref) {
      return;
    }

    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(href);
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchInput, search, router]);

  return (
    <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden">
      <div className="shrink-0">
        <div className="flex max-w-md flex-col gap-1.5">
          <Label htmlFor="compensation-search">Search</Label>
          <Input
            id="compensation-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Name, code, department…"
          />
        </div>
      </div>

      <CompensationTable
        className="md:min-h-0 md:flex-1"
        items={items}
        loading={isPending}
        resetDeps={[search]}
      />
    </div>
  );
}
