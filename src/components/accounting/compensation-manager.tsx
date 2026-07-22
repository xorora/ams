"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CompensationTable } from "@/components/accounting/compensation-table";
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
import { importXororaCnplCompensationAction } from "@/lib/accounting/actions";
import {
  formatYearMonthShort,
  listRecentYearMonths,
} from "@/lib/accounting/format";
import { compensationListQuery } from "@/lib/accounting/query-params";
import type { SerializedCompensationListItem } from "@/lib/accounting/types";
import { toastAsync } from "@/lib/toast";

type CompensationManagerProps = {
  items: SerializedCompensationListItem[];
  search: string;
  yearMonth: string;
  showCnplImport?: boolean;
};

export function CompensationManager({
  items,
  search,
  yearMonth,
  showCnplImport = false,
}: CompensationManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(search);
  const [importing, setImporting] = useState(false);
  const monthOptions = listRecentYearMonths(18);
  const monthItems = Object.fromEntries(
    monthOptions.map((month) => [month, formatYearMonthShort(month)]),
  );

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const href = `/admin/accounting/compensation${compensationListQuery({
      search: searchInput,
      yearMonth,
    })}`;
    const currentHref = `/admin/accounting/compensation${compensationListQuery({
      search,
      yearMonth,
    })}`;
    if (href === currentHref) {
      return;
    }

    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(href);
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchInput, search, yearMonth, router]);

  function navigateMonth(nextYearMonth: string) {
    startTransition(() => {
      router.replace(
        `/admin/accounting/compensation${compensationListQuery({
          search: searchInput,
          yearMonth: nextYearMonth,
        })}`,
      );
    });
  }

  async function handleCnplImport() {
    setImporting(true);
    try {
      await toastAsync(
        importXororaCnplCompensationAction().then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          const data = result.data;
          return `Imported ${data.matched.length} employees (${data.updated} updated, ${data.inserted} inserted).`;
        }),
        {
          loading: "Importing CNPL compensation…",
          success: (message) => message,
        },
      );
      startTransition(() => router.refresh());
    } catch {
      // toastAsync already surfaced the error
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[140px] flex-col gap-1.5">
            <Label htmlFor="compensation-month">Month</Label>
            <Select
              items={monthItems}
              value={yearMonth}
              onValueChange={(value) => {
                if (value) {
                  navigateMonth(value);
                }
              }}
            >
              <SelectTrigger id="compensation-month" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month} value={month}>
                    {formatYearMonthShort(month)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-[220px] max-w-md flex-1 flex-col gap-1.5">
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
        {showCnplImport ? (
          <Button
            type="button"
            variant="outline"
            disabled={importing || isPending}
            onClick={() => void handleCnplImport()}
          >
            {importing ? "Importing…" : "Import CNPL salary sheet"}
          </Button>
        ) : null}
      </div>

      <CompensationTable
        className="md:min-h-0 md:flex-1"
        items={items}
        yearMonth={yearMonth}
        loading={isPending}
        resetDeps={[search, yearMonth]}
      />
    </div>
  );
}
